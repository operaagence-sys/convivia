// Hook 12 — PreToolUse (Bash|PowerShell|Monitor). Irreversible or outward-facing actions.
//  - DENY: what an agent never has to do — the project owner runs it himself
//    (git push of any kind, deploys, publication, recursive deletion outside the
//    throw-away build folders, cloud / CI write actions, dangerous git settings).
//  - ASK: what an agent may legitimately need (git reset --hard, git clean -f,
//    a new dependency outside the allow-list...).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runHook, ask, deny, toSlash, isShellTool, shellCommand, canonPath, projectRoot } from './lib/common.mjs';
import { allSegments, commandOf, hasShortFlag, inlineCodeOf } from './lib/shell.mjs';

const SAFE_RM_DIRS = new Set(['node_modules', '.next', 'dist', 'coverage', '.turbo', '.cache', '.swc', 'build', '.vercel']);
// Options of npm / pnpm / yarn / bun that take a separate value.
const PM_VALUE_OPTS = new Set(['-w', '--workspace', '--prefix', '--cache', '--userconfig', '--globalconfig', '--loglevel', '-C', '--filter', '-F', '--dir', '--cwd', '--tag', '--otp', '--install-strategy', '--omit', '--include', '--save-prefix', '--before', '--script-shell', '--node-options', '--npmrc', '--config', '-c']);

/* ------------------------------------------------------------------ */
/* git                                                                 */
/* ------------------------------------------------------------------ */

const GIT_VALUE_GLOBALS = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace', '--exec-path', '--config-env']);
// Settings that make git run a command: never set by an agent.
const DANGEROUS_GIT_KEY = /^(?:core\.(?:fsmonitor|hookspath|sshcommand|editor|pager|askpass|gitproxy|attributesfile)|alias\.|filter\.|diff\.(?:external|[^.]+\.(?:command|textconv))|credential\.|protocol\.|http\.|url\.|include|merge\.[^.]+\.driver|pager\.|sequence\.editor|gpg\.|receive\.|uploadpack\.|sendemail\.|safe\.directory|init\.templatedir|remote\.[^.]+\.(?:url|pushurl|receivepack|uploadpack|proxy))/i;

function gitSplit(args) {
  const globals = [];
  let i = 0;
  while (i < args.length && args[i].startsWith('-')) {
    if (GIT_VALUE_GLOBALS.has(args[i])) {
      globals.push([args[i], args[i + 1] || '']);
      i += 2;
    } else {
      globals.push([args[i], '']);
      i += 1;
    }
  }
  return { globals, sub: (args[i] || '').toLowerCase(), rest: args.slice(i + 1) };
}

function checkGit(args) {
  const { globals, sub, rest } = gitSplit(args);
  const r = rest.map((x) => (x.startsWith('--') ? x.toLowerCase() : x));
  const out = { deny: [], ask: [] };
  for (const [flag, val] of globals) {
    if ((flag === '-c' || flag === '--config-env') && DANGEROUS_GIT_KEY.test(val.split('=')[0])) out.deny.push(`git -c ${val.split('=')[0]} : réglage qui fait exécuter une commande à git`);
  }
  if (sub === 'push' || sub === 'send-pack') out.deny.push('git push (envoi vers un dépôt distant : c\'est le porteur du projet qui pousse)');
  if (sub === 'config') {
    const pos = r.filter((x) => !x.startsWith('-'));
    const readOnly = r.some((x) => ['--get', '--get-all', '--get-regexp', '--list', '-l', '--get-urlmatch', '--show-origin', '--show-scope', '--name-only'].includes(x));
    const writes = !readOnly && (pos.length >= 2 || r.some((x) => ['--add', '--unset', '--unset-all', '--replace-all', '--edit', '-e', '--rename-section', '--remove-section'].includes(x)));
    if (writes) out.deny.push('git config en écriture (alias, hooks, filtres, proxy… peuvent faire exécuter du code à git)');
  }
  if (sub === 'rm' && !r.includes('--cached') && (r.includes('--recursive') || hasShortFlag(r.filter((x) => !x.startsWith('--')), 'r') || hasShortFlag(r.filter((x) => !x.startsWith('--')), 'f'))) {
    out.deny.push('git rm -r / -f (suppression de fichiers du dossier de travail)');
  }
  if (sub === 'reset' && r.includes('--hard')) out.ask.push('git reset --hard (perte des modifications locales)');
  if (sub === 'clean' && (r.includes('--force') || hasShortFlag(r, 'f'))) out.ask.push('git clean -f (suppression de fichiers non suivis)');
  if (sub === 'branch' && (r.includes('-D') || hasShortFlag(r.filter((x) => !x.startsWith('--')), 'D') || (r.includes('--delete') && r.includes('--force')))) out.ask.push('git branch -D (suppression forcée d\'une branche)');
  if (sub === 'checkout' && (r.includes('.') || r.includes('--force') || hasShortFlag(r.filter((x) => !x.startsWith('--')), 'f'))) out.ask.push('git checkout . / -f (perte des modifications locales)');
  if (sub === 'switch' && (r.includes('--discard-changes') || r.includes('--force') || hasShortFlag(r.filter((x) => !x.startsWith('--')), 'f'))) out.ask.push('git switch -f (perte des modifications locales)');
  if (sub === 'restore' && r.some((x) => x === '.') && !r.includes('--staged')) out.ask.push('git restore . (perte des modifications locales)');
  if (['filter-branch', 'filter-repo'].includes(sub)) out.ask.push(`git ${sub} (réécriture de l'historique)`);
  if (sub === 'reflog' && r.includes('expire')) out.ask.push('git reflog expire (perte de l\'historique de secours)');
  if (sub === 'gc' && r.some((x) => x.startsWith('--prune'))) out.ask.push('git gc --prune (suppression d\'objets)');
  return out;
}

/* ------------------------------------------------------------------ */
/* Deletion                                                            */
/* ------------------------------------------------------------------ */

// cmd.exe switches: /f /q /s, possibly glued (/f/q); Git Bash writes them //f //q.
const CMD_SWITCH = /^(?:\/{1,2}[a-z])+$/i;
const switchLetters = (a) => [...a.toLowerCase()].filter((ch) => ch !== '/');
const DELETE_API = /\b(?:rmSync|rmdirSync|unlinkSync|rimraf|removeSync|emptyDirSync|rmtree|os\.remove|os\.unlink|os\.rmdir|pathlib[^\n]*unlink|Directory\.Delete|File\.Delete|Remove-Item|FileUtils\.rm|File\.delete|unlink\()/;
const DELETE_EXEC = new Set(['rm', 'rmdir', 'shred', 'unlink', 'del', 'erase', 'rd']);

/** Targets of a deleting command, or null if the command does not delete in a dangerous way. */
function deletionTargets(prog, args) {
  const nonFlag = (xs) => xs.filter((a) => !a.startsWith('-') && !CMD_SWITCH.test(a));
  if (prog === 'rm') return args.some((a) => a === '--recursive' || /^-[A-Za-z]*[rR][A-Za-z]*$/.test(a)) ? nonFlag(args) : null;
  if (['remove-item', 'ri', 'rd', 'rmdir', 'del', 'erase'].includes(prog)) {
    if (args.some((a) => /^-r(e(c(u(r(s(e)?)?)?)?)?)?$/i.test(a) || /^-fo(r(c(e)?)?)?$/i.test(a))) return nonFlag(args);
    const letters = args.filter((a) => CMD_SWITCH.test(a)).flatMap(switchLetters);
    if (['rd', 'rmdir'].includes(prog) && letters.includes('s')) return nonFlag(args);
    if (['del', 'erase'].includes(prog) && letters.some((l) => ['f', 'q', 's'].includes(l))) return nonFlag(args);
    return null;
  }
  if (['rimraf', 'del-cli', 'trash', 'trash-cli'].includes(prog)) return nonFlag(args);
  if (prog === 'find') {
    const hasDelete = args.includes('-delete') || args.some((a, i) => ['-exec', '-execdir', '-ok', '-okdir'].includes(a) && DELETE_EXEC.has((args[i + 1] || '').toLowerCase().replace(/^.*[\\/]/, '')));
    if (!hasDelete) return null;
    const roots = [];
    for (const a of args) {
      if (a.startsWith('-') || a === '(' || a === '!') break;
      roots.push(a);
    }
    return roots.length ? roots : ['.'];
  }
  if (prog === 'robocopy' && args.some((a) => /^\/{1,2}(mir|purge)$/i.test(a))) return [nonFlag(args)[1] || '*'];
  if (prog === 'rsync' && args.some((a) => a.startsWith('--delete') || a === '--remove-source-files')) return [nonFlag(args).pop() || '*'];
  return null;
}

const norm = (p) => (process.platform === 'win32' ? p.toLowerCase() : p);

function insideDir(abs, rootAbs) {
  if (!rootAbs) return false;
  const rel = path.relative(norm(rootAbs), norm(abs));
  return !!rel && !rel.startsWith('..') && !path.isAbsolute(rel);
}

/** Expand a leading %TEMP% / %TMP% and (on Windows, Git Bash) /tmp to the system temp dir. */
function expandTemp(t) {
  const m = /^%(temp|tmp)%(?=[\\/]|$)/i.exec(t);
  if (m) {
    const v = process.env[m[1].toUpperCase()];
    return v ? toSlash(v) + t.slice(m[0].length) : null;
  }
  if (process.platform === 'win32' && /^\/(?:var\/)?tmp(?=\/|$)/.test(t)) return toSlash(os.tmpdir()) + t.replace(/^\/(?:var\/)?tmp/, '');
  return t;
}

/** A path is exempt only when it RESOLVES (symlinks included) strictly under the system temp dir or scratchpad_dir. */
function underTempOrScratch(raw, scratch, cwd, root) {
  if (/[$`*?[]/.test(raw)) return false;
  const t = toSlash(raw).replace(/\/+$/, '');
  if (!t || t.split('/').includes('..')) return false;
  const expanded = expandTemp(t);
  if (!expanded || /%/.test(expanded)) return false;
  // Relative paths are never exempt: the working directory itself may sit under the temp dir.
  if (!path.isAbsolute(expanded) && !/^[A-Za-z]:\//.test(expanded) && !expanded.startsWith('/')) return false;
  const abs = canonPath(expanded, root, cwd);
  const roots = [os.tmpdir(), scratch];
  if (process.platform !== 'win32') roots.push('/tmp', '/var/tmp');
  return roots.filter(Boolean).some((r) => insideDir(abs, canonPath(r, root, root)));
}

function rmTargetSafe(target, scratch, cwd, root) {
  const t = toSlash(target).replace(/\/+$/, '');
  if (!t) return false;
  if (underTempOrScratch(target, scratch, cwd, root)) return true;
  if (/[$`%]/.test(t) || /^~/.test(t)) return false;
  // Safe only INSIDE the project, by the canonical (resolved) path: `..`, Git Bash forms, links and case are settled.
  const abs = canonPath(t, root, cwd);
  const rootAbs = canonPath(root, root, root);
  if (!insideDir(abs, rootAbs)) return false;
  const comps = path.relative(norm(rootAbs), norm(abs)).split(/[\\/]/).filter(Boolean);
  return comps.length > 0 && comps.some((c) => SAFE_RM_DIRS.has(c)) && (SAFE_RM_DIRS.has(comps[comps.length - 1]) || comps.includes('node_modules') || comps.includes('.next') || comps.includes('dist'));
}

/* ------------------------------------------------------------------ */
/* Dependencies (allow-list)                                           */
/* ------------------------------------------------------------------ */

function loadAllowed() {
  try {
    const file = path.join(path.dirname(fileURLToPath(import.meta.url)), 'allowed-packages.json');
    const j = JSON.parse(fs.readFileSync(file, 'utf8'));
    const names = new Set((Array.isArray(j.packages) ? j.packages : []).map((x) => String(x).toLowerCase()));
    for (const n of [...names]) {
      if (!n.startsWith('@types/')) names.add('@types/' + n.replace(/^@/, '').replace('/', '__'));
    }
    return { names, ok: names.size > 0 };
  } catch {
    return { names: new Set(), ok: false };
  }
}

function distance(a, b) {
  if (Math.abs(a.length - b.length) > 3) return 99;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}

// A version / range / dist-tag: never a URL, a path, a git ref or an `npm:` alias.
const VERSION_OK = /^[A-Za-z0-9.\-+~^<>=|* ]*$/;

/** Registry package name from an install argument, or null if it is not a plain registry spec. */
export function packageName(spec) {
  const s = String(spec).trim();
  if (!s || /^(?:\.{0,2}[\\/]|~|[A-Za-z]:[\\/])/.test(s) || /^(?:file|git|git\+[a-z]+|https?|ssh|github|gitlab|bitbucket|npm|link|workspace|portal):/i.test(s) || /\.(?:tgz|tar|tar\.gz|zip)$/i.test(s)) return null;
  const m = /^(@[a-z0-9._~-]+\/[a-z0-9._~-]+|[a-z0-9._~-]+)(?:@(.*))?$/i.exec(s);
  if (!m) return null;
  if (m[2] !== undefined && !VERSION_OK.test(m[2])) return null; // pkg@url, pkg@git+..., pkg@npm:other (alias), pkg@file:...
  return m[1].toLowerCase();
}

function nearestListed(name, names) {
  const unscoped = (n) => n.replace(/^@[^/]+\//, '');
  let best = null;
  for (const listed of names) {
    if (listed.startsWith('@types/')) continue;
    const d = distance(name, listed);
    if (d <= 2 || (unscoped(name) === unscoped(listed) && name !== listed)) {
      if (!best || d < best.d) best = { name: listed, d };
    }
  }
  return best && best.name;
}

// Executable name -> package that provides it (npx / bunx resolve a bin name as a package name).
const BIN_PACKAGE = {
  tsc: 'typescript', tsserver: 'typescript', next: 'next', vitest: 'vitest', eslint: 'eslint', prettier: 'prettier',
  playwright: 'playwright', supabase: 'supabase', lhci: '@lhci/cli', serwist: 'serwist',
};

function isLocalBin(name, cwd, root) {
  const bare = name.replace(/^@[^/]+\//, '');
  for (let dir = cwd, guard = 0; dir && guard < 12; guard++) {
    for (const ext of ['', '.cmd', '.ps1']) {
      try {
        if (fs.existsSync(path.join(dir, 'node_modules', '.bin', bare + ext))) return true;
      } catch {
        /* ignore */
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir || !insideDir(dir, canonPath(root, root, root))) break;
    dir = parent;
  }
  return false;
}

function specProblems(specs, allowed, ctx, { bins = false } = {}) {
  const out = [];
  for (const spec of specs) {
    const name = packageName(spec);
    if (name === null) {
      out.push(`« ${spec} » : source hors registre (chemin, URL, tarball, git, alias npm:)`);
      continue;
    }
    const mapped = bins && BIN_PACKAGE[name] ? BIN_PACKAGE[name] : name;
    if (allowed.names.has(mapped)) continue;
    if (bins && isLocalBin(name, ctx.cwd, ctx.root)) continue;
    const near = allowed.ok ? nearestListed(name, allowed.names) : null;
    out.push(near ? `« ${name} » : paquet hors liste / nom proche de « ${near} » (faute de frappe ou portée différente ?)` : `« ${name} » : paquet hors liste`);
  }
  return out;
}

/** package.json declares dependencies / scripts that `npm install` would fetch or run. */
function manifestProblems(ctx, allowed) {
  const out = [];
  let pkg;
  for (const dir of [ctx.cwd, ctx.root]) {
    try {
      pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
      break;
    } catch {
      /* try next */
    }
  }
  if (!pkg) return out;
  const bad = [];
  for (const field of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
    for (const [name, spec] of Object.entries(pkg[field] || {})) {
      if (!allowed.names.has(String(name).toLowerCase())) bad.push(`${name}`);
      else if (packageName(`${name}@${String(spec)}`) === null) bad.push(`${name} (source « ${String(spec).slice(0, 40)} »)`);
    }
  }
  for (const field of ['overrides', 'resolutions']) {
    const text = JSON.stringify(pkg[field] || {});
    if (/(?:https?|git\+?[a-z]*|file|github|npm|link):/i.test(text)) bad.push(`${field} (source hors registre)`);
  }
  if (bad.length) out.push(`package.json déclare des dépendances hors liste ou hors registre : ${bad.slice(0, 6).join(', ')}`);
  const scripts = Object.keys(pkg.scripts || {}).filter((k) => /^(?:pre|post)?(?:install|prepare|prepublish|prepublishOnly|prepack)$/.test(k) || k === 'install');
  if (scripts.length) out.push(`package.json contient des scripts exécutés à l'installation (${scripts.join(', ')})`);
  return out;
}

const INSTALL_SUBS = new Set(['i', 'in', 'ins', 'inst', 'insta', 'instal', 'isntall', 'install', 'add', 'ci', 'clean-install', 'ic', 'install-clean', 'isntall-clean', 'it', 'install-test', 'cit', 'install-ci-test', 'update', 'up', 'upgrade', 'udpate', 'upgrade-interactive', 'link', 'ln', 'rebuild', 'rb', 'dedupe', 'ddp']);
const NON_INSTALL = new Set(['run', 'run-script', 'rum', 'urn', 'test', 't', 'tst', 'start', 'stop', 'restart', 'exec', 'x', 'view', 'v', 'info', 'show', 'ls', 'list', 'll', 'la', 'outdated', 'audit', 'pack', 'config', 'c', 'get', 'prefix', 'root', 'bin', 'help', 'version', 'whoami', 'ping', 'docs', 'doctor', 'explain', 'why', 'fund', 'search', 'find', 'completion', 'cache', 'init', 'create', 'innit', 'prune', 'uninstall', 'remove', 'rm', 'r', 'un', 'unlink', 'dlx']);
const PUBLISH_SUBS = new Set(['publish', 'unpublish', 'deprecate', 'dist-tag', 'access', 'owner', 'token', 'login', 'adduser', 'logout', 'team', 'org', 'star', 'unstar', 'hook']);

function checkDeps(c, ctx, allowed) {
  const out = { deny: [], ask: [] };
  if (!['npm', 'pnpm', 'yarn', 'bun'].includes(c.prog)) return out;
  // Registry / config redirection through the environment.
  if (c.assigns.some((a) => /^(?:npm_config_|NPM_CONFIG_)?(?:[A-Za-z@:_-]*registry|userconfig|globalconfig|script[-_]shell|node[-_]options|prefix|ignore[-_]scripts)=/i.test(a) || /^(?:YARN_NPM_REGISTRY_SERVER|BUN_CONFIG_REGISTRY|NODE_OPTIONS)=/i.test(a))) {
    out.ask.push('variable d\'environnement qui change le registre ou la configuration du gestionnaire de paquets');
  }
  // Split options / positionals; value-taking options are consumed.
  const pos = [];
  const flags = [];
  for (let i = 0; i < c.args.length; i++) {
    const x = c.args[i];
    if (x === '--') {
      pos.push(...c.args.slice(i + 1));
      break;
    }
    if (x.startsWith('-')) {
      flags.push(x);
      if (PM_VALUE_OPTS.has(x)) i++;
      continue;
    }
    pos.push(x);
  }
  const lowerPos = pos.map((x) => x.toLowerCase());
  // publication, login, tokens: the owner does it
  const pubIdx = lowerPos.findIndex((x) => PUBLISH_SUBS.has(x));
  if (pubIdx === 0 || (c.prog === 'yarn' && lowerPos[0] === 'npm' && lowerPos.some((x) => PUBLISH_SUBS.has(x)))) {
    out.deny.push(`${c.prog} ${lowerPos.find((x) => PUBLISH_SUBS.has(x))} (publication ou gestion de compte du registre : réservé au porteur du projet)`);
    return out;
  }
  if (c.prog === 'yarn' && lowerPos[0] === 'set' && lowerPos[1] === 'version') out.ask.push('yarn set version télécharge un exécutable de gestionnaire');
  if (c.prog === 'pnpm' && ['self-update', 'env'].includes(lowerPos[0])) out.ask.push(`pnpm ${lowerPos[0]} télécharge un exécutable`);
  if (c.prog === 'bun' && ['upgrade'].includes(lowerPos[0])) out.ask.push('bun upgrade télécharge un exécutable');

  let k = -1;
  const bareInstall = lowerPos.length === 0 && c.prog === 'yarn'; // bare `yarn` installs
  if (lowerPos.length && !NON_INSTALL.has(lowerPos[0])) k = lowerPos.findIndex((x) => INSTALL_SUBS.has(x));
  if (k < 0 && !bareInstall) return out;
  const sub = k >= 0 ? lowerPos[k] : 'install';
  const pkgs = k >= 0 ? pos.slice(k + 1) : [];

  const problems = [];
  const flagText = flags.map((x) => x.toLowerCase());
  if (flagText.some((x) => x === '-g' || x === '--global' || x === '--location=global')) problems.push('installation globale (-g)');
  if (flagText.some((x) => /registry/.test(x))) problems.push('registre personnalisé (--registry)');
  if (flagText.some((x) => /^--(?:userconfig|globalconfig|npmrc)/.test(x))) problems.push('fichier de configuration npm personnalisé');
  problems.push(...specProblems(pkgs, allowed, ctx));
  if (!allowed.ok) problems.push('liste blanche .claude/hooks/allowed-packages.json absente ou illisible');
  if (!pkgs.length) problems.push(...manifestProblems(ctx, allowed));
  if (!problems.length) return out;
  out.ask.push(`ajout/installation de dépendances (${c.prog} ${sub} ${pkgs.slice(0, 4).join(' ')}) : ${problems.join(' ; ')}. Vérifie l'existence et la maintenance du paquet (npm view) avant de l'ajouter à la liste blanche`);
  return out;
}

function checkRunners(c, ctx, allowed) {
  const out = [];
  for (const r of c.runners) {
    if (r.inline.length) out.push(`${r.via} -c : commande shell en ligne exécutée par l'exécuteur de paquet`);
    if (r.flags.some((x) => /registry|userconfig|npmrc/i.test(x))) out.push(`${r.via} avec registre / configuration personnalisés`);
    let specs = r.specs.slice();
    if (!specs.length && r.cmd && !/^(?:\.{0,2}[\\/]|[A-Za-z]:[\\/]|-)/.test(r.cmd)) specs = [r.cmd];
    const problems = specProblems(specs, allowed, ctx, { bins: !r.create });
    if (problems.length) out.push(`${r.via} : exécution d'un paquet non installé / hors liste (${problems.join(' ; ')})`);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Vercel, GitHub CLI, cloud                                           */
/* ------------------------------------------------------------------ */

// Read-only or local-only forms an agent may use. Everything else (deploy, promote, env writes, pull, link...) is the owner's.
function vercelDeny(args) {
  const a = args.map((x) => x.toLowerCase());
  const sub = a.filter((x) => !x.startsWith('-'));
  if (a.some((x) => x === '--token' || x.startsWith('--token=') || x === '-t')) return 'vercel avec un jeton explicite';
  if (!sub.length) return a.some((x) => ['--version', '-v', '--help', '-h'].includes(x)) ? '' : 'vercel sans sous-commande = déploiement';
  if (['whoami', 'ls', 'list', 'inspect', 'logs', 'help', 'dev', 'build', 'bisect'].includes(sub[0])) return '';
  if (sub[0] === 'env' && ['ls', 'list'].includes(sub[1])) return '';
  if (['project', 'projects', 'teams', 'domains', 'certs', 'dns'].includes(sub[0]) && ['ls', 'list', 'inspect'].includes(sub[1])) return '';
  if (sub[0] === 'promote') return 'vercel promote (mise en production)';
  return `vercel ${sub.slice(0, 2).join(' ')} (déploiement, variables ou configuration distantes : réservé au porteur du projet)`;
}

function ghDeny(args) {
  const a = args.map((x) => x.toLowerCase());
  const sub = a.filter((x) => !x.startsWith('-'));
  if (!sub.length) return '';
  const READ = {
    auth: ['status'], pr: ['view', 'list', 'status', 'checks', 'diff'], issue: ['view', 'list', 'status'], run: ['list', 'view', 'watch'], repo: ['view'],
    workflow: ['list', 'view'], release: ['list', 'view'], help: null, version: null, status: null,
  };
  if (sub[0] in READ && (READ[sub[0]] === null || !sub[1] || READ[sub[0]].includes(sub[1]))) return '';
  return `gh ${sub.slice(0, 2).join(' ')} (action sur GitHub : réservé au porteur du projet)`;
}

const CLOUD_PROGS = new Set(['netlify', 'wrangler', 'firebase', 'flyctl', 'fly', 'railway', 'heroku', 'aws', 'gcloud', 'az', 'kubectl', 'helm', 'terraform', 'pulumi', 'ansible', 'ansible-playbook', 'serverless', 'sls', 'amplify']);

function checkVercelAndCloud(c) {
  if (c.prog === 'vercel') {
    const r = vercelDeny(c.args);
    return r ? [r] : [];
  }
  if (c.prog === 'gh') {
    const r = ghDeny(c.args);
    return r ? [r] : [];
  }
  if (CLOUD_PROGS.has(c.prog)) return [`${c.prog} (déploiement ou action sur un service distant : réservé au porteur du projet)`];
  if (c.prog === 'docker' && ['push', 'login', 'logout'].includes((c.args.find((x) => !x.startsWith('-')) || '').toLowerCase())) return ['docker push/login (registre distant)'];
  if (c.prog === 'supabase') {
    const sub = c.args.filter((x) => !x.startsWith('-')).map((x) => x.toLowerCase());
    if (sub[0] === 'functions' && sub[1] === 'deploy') return ['supabase functions deploy (déploiement d\'une Edge Function)'];
    if (sub[0] === 'secrets' && ['set', 'unset'].includes(sub[1])) return ['supabase secrets set (modification d\'un secret distant)'];
  }
  return [];
}

/* ------------------------------------------------------------------ */

runHook({ name: 'irreversible-actions', event: 'PreToolUse', failMode: 'closed' }, (input) => {
  if (!isShellTool(input.tool_name)) return undefined;
  const command = shellCommand(input);
  const scratch = input.scratchpad_dir || '';
  const root = projectRoot(input);
  const baseCwd = input.cwd || root;
  const denies = [];
  const asks = [];
  const allowed = loadAllowed();
  let cwd = canonPath(baseCwd, root, root);
  for (const seg of allSegments(command)) {
    const c = commandOf(seg.words);
    if (!c) continue;
    const { prog, args } = c;
    if (['cd', 'pushd', 'set-location', 'chdir'].includes(prog)) {
      const t = args.find((x) => !x.startsWith('-'));
      if (t) cwd = canonPath(t, root, cwd);
      continue;
    }
    const ctx = { cwd, root };
    if (prog === 'git') {
      const r = checkGit(args);
      denies.push(...r.deny);
      asks.push(...r.ask);
    }
    const targets = deletionTargets(prog, args);
    if (targets) {
      const bad = targets.filter((t) => !rmTargetSafe(t, scratch, cwd, root));
      if (!targets.length || bad.length) denies.push(`suppression récursive ou forcée (${prog}) hors dossiers de build jetables : ${(bad.length ? bad : ['aucune cible lisible']).slice(0, 3).join(', ')}`);
    }
    if (['node', 'nodejs', 'python', 'python3', 'py', 'deno', 'bun', 'perl', 'ruby', 'php'].includes(prog) && DELETE_API.test(inlineCodeOf(seg, c))) {
      denies.push(`suppression de fichiers par code en ligne (${prog}) : utilise rm sur un dossier de build, ou laisse le porteur du projet le faire`);
    }
    denies.push(...checkVercelAndCloud(c));
    const deps = checkDeps(c, ctx, allowed);
    denies.push(...deps.deny);
    asks.push(...deps.ask);
    asks.push(...checkRunners(c, ctx, allowed));
  }
  if (denies.length) return deny(`Action réservée au porteur du projet (jamais lancée par un agent) : ${[...new Set(denies)].join(' ; ')}.`);
  if (asks.length) return ask(`Action irréversible ou sortante : ${[...new Set(asks)].join(' ; ')}. Confirmation du porteur du projet requise.`);
  return undefined;
});
