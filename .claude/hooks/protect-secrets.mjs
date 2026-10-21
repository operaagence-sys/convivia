// Hook 1 — PreToolUse (Read|Edit|Write|MultiEdit|NotebookEdit|Bash|Grep)
// Refuses access to secret files and any secret written into the repository.
import fs from 'node:fs';
import path from 'node:path';
import {
  runHook, deny, protectedKind, toolPath, addedContent, WRITE_TOOLS, findSecrets, refsSecretVar, SECRET_ENV_VARS, isShellTool, shellCommand,
} from './lib/common.mjs';
import { allSegments, commandOf, baseProgram, inlineCodeOf } from './lib/shell.mjs';

const WHY = ' (CLAUDE.md § 5 : aucun secret dans le dépôt ni dans la conversation). Demande au porteur du projet de gérer ce fichier lui-même ; utilise .env.example (valeurs vides) pour décrire les variables.';

// Programs that read or write the file they receive as argument.
const FILE_VERBS = new Set([
  'cat', 'tac', 'type', 'more', 'less', 'most', 'head', 'tail', 'grep', 'egrep', 'fgrep', 'rg', 'ag', 'ack', 'sed', 'awk',
  'gawk', 'cut', 'sort', 'uniq', 'tr', 'paste', 'nl', 'od', 'xxd', 'hexdump', 'strings', 'base64', 'bat', 'batcat', 'view',
  'vi', 'vim', 'nvim', 'nano', 'emacs', 'code', 'notepad', 'source', '.', 'cp', 'mv', 'copy', 'move', 'xcopy', 'robocopy',
  'tee', 'dd', 'install', 'ln', 'curl', 'wget', 'scp', 'rsync', 'get-content', 'gc', 'select-string', 'sls', 'out-file',
  'set-content', 'add-content', 'copy-item', 'move-item', 'rename-item', 'ren', 'remove-item', 'rm', 'del', 'erase',
  'unlink', 'shred', 'diff', 'cmp', 'comm', 'jq', 'yq', 'wc', 'tar', 'zip', '7z', 'gzip', 'openssl', 'node', 'nodejs',
  'python', 'python3', 'py', 'deno', 'bun', 'perl', 'ruby', 'php', 'xargs', 'find', 'bash', 'sh', 'zsh', 'pwsh',
  'powershell', 'cmd', 'git', 'mapfile', 'readarray', 'read', 'dotenv', 'dotenvx', 'rev', 'fold', 'fmt', 'column', 'pr', 'split', 'csplit',
  'shuf', 'join', 'expand', 'unexpand', 'ed', 'ex', 'clip', 'xclip', 'pbcopy', 'certutil', 'bsdtar', 'unzip', 'cpio', 'ar', 'lynx', 'w3m',
]);
// Programs for which an .env.example argument is a modification.
const EXAMPLE_WRITE_VERBS = new Set(['tee', 'dd', 'install', 'ln', 'out-file', 'set-content', 'add-content', 'remove-item', 'rm', 'del', 'erase', 'unlink', 'shred', 'ren', 'rename-item', 'mv', 'move', 'move-item']);
const COPY_VERBS = new Set(['cp', 'copy', 'copy-item', 'xcopy', 'robocopy']);
const PRINT_VERBS = new Set(['echo', 'printf', 'print', 'write-host', 'write-output', 'write', 'out-host', 'cat', 'type']);
const INTERPRETERS = new Set(['node', 'nodejs', 'python', 'python3', 'py', 'deno', 'bun', 'perl', 'ruby', 'php', 'pwsh', 'powershell']);
const SECRET_NAMES = new Set(SECRET_ENV_VARS.map((s) => s.toLowerCase()));

const ESCAPE_RE = /[.+^${}()|\\]/g;

/** Does a shell glob (`.env*`, `*.pem`, `.e?v`) possibly match a secret file name? */
function globHitsSecret(token, ctx) {
  const base = token.split('\\').join('/').split('/').pop();
  if (!/[*?[]/.test(base)) return false;
  let re = '';
  for (let i = 0; i < base.length; i++) {
    const c = base[i];
    if (c === '*') re += '[^/]*';
    else if (c === '?') re += '[^/]';
    else if (c === '[' && base.indexOf(']', i) > i) {
      const j = base.indexOf(']', i);
      re += base.slice(i, j + 1).replace(/^\[!/, '[^');
      i = j;
    } else re += c.replace(ESCAPE_RE, (m) => '\\' + m);
  }
  let rx;
  try {
    rx = new RegExp('^' + re + '$', 'i');
  } catch {
    return false;
  }
  if (!base.startsWith('.') && /^[*?[]/.test(base)) {
    // shell globs do not match dotfiles unless the dot is explicit: look at the files that really exist
    // (a bare `*` must not be refused just because *.pem could exist), and fall back to the pattern when the folder is unreadable.
    try {
      const dir = path.resolve(ctx.cwd, token.replace(/\\/g, '/').split('/').slice(0, -1).join('/') || '.');
      return fs.readdirSync(dir).some((n) => !n.startsWith('.') && rx.test(n) && protectedKind(n) === 'secret');
    } catch {
      return /pem|key|p12|pfx/i.test(base) && ['server.pem', 'a.key', 'a.p12'].some((n) => rx.test(n));
    }
  }
  return ['.env', '.env.local', '.env.production', 'x.pem', 'x.key'].some((n) => rx.test(n));
}

/** Bash brace expansion: `{.en,}v` -> `.env`, `v` (bounded). */
function braceExpand(word, limit = 64) {
  const m = /^(.*?)\{([^{}]*,[^{}]*)\}(.*)$/s.exec(word);
  if (!m) return [word];
  const out = [];
  for (const alt of m[2].split(',')) {
    for (const rest of braceExpand(m[1] + alt + m[3], limit)) {
      out.push(rest);
      if (out.length >= limit) return out;
    }
  }
  return out;
}

/** Classify a command-line token: 'secret' / 'example' / null. */
function kindOfToken(v, ctx) {
  const expanded = braceExpand(v);
  if (expanded.length === 1 && expanded[0] === v) return kindOfToken1(v, ctx);
  let kind = null;
  for (const e of expanded) {
    const k = kindOfToken1(e, ctx);
    if (k === 'secret') return 'secret';
    if (k === 'example') kind = 'example';
  }
  return kind;
}

function kindOfToken1(v, ctx) {
  if (/(^|\/)proc\/[^/]+\/environ$/.test(String(v).split('\\').join('/'))) return 'secret';
  const variants = new Set([v, v.replace(/^[@<>]+/, '')]);
  if (v.includes(':') && !/^[A-Za-z]:[\\/]/.test(v)) variants.add(v.slice(v.lastIndexOf(':') + 1)); // git show HEAD:.env
  let kind = null;
  for (const x of variants) {
    const k = protectedKind(ctx.rel(x));
    if (k === 'secret') return 'secret';
    if (k === 'example') kind = 'example';
    if (globHitsSecret(x, ctx)) return 'secret';
  }
  return kind;
}

function checkExampleContent(text) {
  const bad = [];
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.replace(/\s+#.*$/, '').trim();
    if (!line || line.startsWith('#')) continue;
    if (!/^(?:export\s+)?[A-Za-z_][A-Za-z0-9_]*\s*=\s*(?:""|'')?\s*$/.test(line)) bad.push(line.split('=')[0].slice(0, 60));
  }
  return bad;
}

function secretsReason(list) {
  const kinds = [...new Set(list.map((s) => `${s.kind} (ligne ${s.line})`))];
  return `Secret détecté dans le contenu : ${kinds.join(', ')}. Les secrets ne vont que dans Vercel et Supabase, jamais dans le code${WHY}`;
}

function checkBash(command, ctx) {
  const sec = findSecrets(command);
  if (sec.length) return deny(secretsReason(sec));
  if (/\b(?:compgen\s+-[ev]|declare\s+-[a-zA-Z]*[xp]|typeset\s+-[a-zA-Z]*[xp])\b/.test(command) && !/=/.test(command)) {
    return deny(`Affichage de l'environnement interdit${WHY}`);
  }
  for (const seg of allSegments(command)) {
    for (const r of seg.redirs) {
      if (!r.target || /^(&?\d+|-)$/.test(r.target)) continue;
      const k = kindOfToken(r.target, ctx);
      if (k === 'secret') return deny(`Redirection ${r.op} vers/depuis un fichier secret (${r.target})${WHY}`);
      if (k === 'example' && r.op !== '<') return deny(`Écriture en shell dans .env.example : utilise l'outil Edit/Write (valeurs vides uniquement)${WHY}`);
    }
    const c = commandOf(seg.words);
    if (!c) continue;
    const { prog, args } = c;
    const first = baseProgram(seg.words[0]);
    // Environment dumps
    if (prog === 'printenv' && (args.length === 0 || args.some((a) => SECRET_NAMES.has(a.toLowerCase())))) {
      return deny(`printenv expose des variables secrètes${WHY}`);
    }
    if (first === 'env' && seg.words.length === 1) return deny(`« env » seul affiche toutes les variables secrètes${WHY}`);
    if (first === 'set' && seg.words.length === 1) return deny(`« set » seul affiche toutes les variables secrètes${WHY}`);
    if ((first === 'export' || first === 'declare' || first === 'typeset') && args.some((a) => /^-[a-z]*[px][a-z]*$/i.test(a)) && !args.some((a) => /=/.test(a))) {
      return deny(`Affichage de l'environnement interdit${WHY}`);
    }
    if (['get-childitem', 'gci', 'dir', 'ls', 'get-item', 'gi', 'get-content', 'gc'].includes(prog) && args.some((a) => /^env:/i.test(a))) {
      return deny(`Lecture du lecteur env: interdite${WHY}`);
    }
    if (PRINT_VERBS.has(prog) && args.some((a) => refsSecretVar(a))) {
      return deny(`Affichage d'une variable secrète interdit${WHY}`);
    }
    // Files passed as arguments
    if (!FILE_VERBS.has(prog)) continue;
    const isSedInPlace = prog === 'sed' && args.some((a) => a === '-i' || /^-[a-z]*i/.test(a) || a.startsWith('--in-place'));
    const candidates = [];
    for (const a of args) {
      candidates.push(a);
      const eq = a.indexOf('=');
      if (eq > 0) candidates.push(a.slice(eq + 1));
    }
    const nonOpt = args.filter((x) => !x.startsWith('-'));
    for (const v of candidates) {
      if (!v || v.startsWith('-')) continue;
      const k = kindOfToken(v, ctx);
      if (k === 'secret') return deny(`Commande « ${prog} » sur un fichier secret (${v})${WHY}`);
      if (k === 'example') {
        const isDest = COPY_VERBS.has(prog) && nonOpt[nonOpt.length - 1] === v && nonOpt.length > 1;
        if (EXAMPLE_WRITE_VERBS.has(prog) || isSedInPlace || isDest) {
          return deny(`Modification de .env.example en shell : utilise l'outil Edit/Write (valeurs vides uniquement)${WHY}`);
        }
      }
    }
    // Interpreters given inline code mentioning a secret file or dumping the environment
    if (INTERPRETERS.has(prog)) {
      const blob = inlineCodeOf(seg, c).split('\\').join('/');
      if (/(^|[\s'"`/(])\.env(?!\.example)(\.[\w.-]+)?(?=$|[\s'"`),;])/i.test(blob)) {
        return deny(`Code inline qui référence un fichier .env${WHY}`);
      }
      const readsEnv = /process\.env|os\.environ|getenv|\$env:|ENV\[/i.test(blob);
      const lower = blob.toLowerCase();
      const namesSecret = [...SECRET_NAMES].some((n) => lower.includes(n));
      const dumpsAll = /process\.env\s*[,)]|os\.environ\s*[,)]|dict\(os\.environ|environ\.items|Object\.(keys|entries|values)\(process\.env/i.test(blob);
      if (readsEnv && (namesSecret || dumpsAll)) return deny(`Code inline qui lit une variable secrète ou tout l'environnement${WHY}`);
    }
  }
  return undefined;
}

runHook({ name: 'protect-secrets', event: 'PreToolUse', failMode: 'closed' }, (input, ctx) => {
  const tool = input.tool_name;
  const ti = input.tool_input || {};
  if (isShellTool(tool)) return checkBash(shellCommand(input), ctx);

  if (tool === 'Grep') {
    const target = ti.path ? protectedKind(ctx.rel(ti.path)) : null;
    const glob = String(ti.glob || '');
    if (target === 'secret' || /(^|[/*{,])\.env(?!\.example)|\*\.(pem|key|p12)/i.test(glob)) {
      return deny(`Recherche dans des fichiers secrets${WHY}`);
    }
    return undefined;
  }

  const fp = toolPath(ti);
  const kind = fp ? protectedKind(ctx.rel(fp)) : null;
  if (kind === 'secret') return deny(`Accès refusé à ${ctx.relRaw(fp)}${WHY}`);
  if (!WRITE_TOOLS.has(tool)) return undefined;

  const content = addedContent(tool, ti);
  if (kind === 'example') {
    const bad = checkExampleContent(content);
    if (bad.length) {
      return deny(`.env.example doit contenir uniquement des lignes « CLÉ= » à valeur vide (et des commentaires). Lignes refusées : ${bad.join(', ')}${WHY}`);
    }
  }
  const sec = findSecrets(content);
  if (sec.length) return deny(secretsReason(sec));
  return undefined;
});
