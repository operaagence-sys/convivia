// Hook 6 — PreToolUse (Bash) on `git commit` / `git push`. Scans what leaves
// for secrets and forbidden files, runs gitleaks if present, then npm audit.
import fs from 'node:fs';
import path from 'node:path';
import {
  runHook, deny, ask, runProc, runNode, npmCliPath, findSecrets, protectedKind, tail, isShellTool, shellCommand,
} from './lib/common.mjs';
import { allSegments, commandOf } from './lib/shell.mjs';
import { scanDiff, parseAudit } from './lib/gitscan.mjs';

const OPT_WITH_VALUE = new Set(['-m', '-F', '-C', '-c', '--message', '--file', '--author', '--date', '--template', '--reuse-message', '--reedit-message', '--cleanup', '--gpg-sign', '-S', '--trailer']);
const GLOBAL_WITH_VALUE = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace']);
const MAX_UNTRACKED_BYTES = 2 * 1024 * 1024;

// Settings that make git run a program stored in the repository (.git/config is editable): neutralised here.
const GIT_SAFE = ['-c', 'core.quotepath=off', '-c', 'core.fsmonitor=false', '-c', 'core.hooksPath=', '-c', 'diff.external=', '-c', 'core.pager=cat'];

function git(cwd, args) {
  return runProc('git', [...GIT_SAFE, ...args], { cwd, timeout: 20000 });
}

/** Scanning git: a timeout or a crash would let an unscanned diff through, so it fails closed (deny). */
function gitScan(cwd, args) {
  const r = git(cwd, args);
  if (r.timedOut) throw new Error('git a dépassé le délai : analyse incomplète');
  if (r.error && !r.missing) throw new Error(`git a échoué (${r.error.message})`);
  return r;
}

/** Describe the git commit/push invocations in a command. */
function findGitActions(command, baseCwd) {
  const actions = [];
  let cwd = baseCwd;
  let sawAdd = false;
  for (const seg of allSegments(command)) {
    const c = commandOf(seg.words);
    if (!c) continue;
    if (c.prog === 'cd' && c.args[0]) {
      cwd = path.resolve(cwd, c.args[0]);
      continue;
    }
    if (c.prog !== 'git') continue;
    let i = 0;
    let segCwd = cwd;
    while (i < c.args.length && c.args[i].startsWith('-')) {
      if (c.args[i] === '-C' && c.args[i + 1]) segCwd = path.resolve(segCwd, c.args[i + 1]);
      i += GLOBAL_WITH_VALUE.has(c.args[i]) ? 2 : 1;
    }
    const sub = (c.args[i] || '').toLowerCase();
    const rest = c.args.slice(i + 1);
    if (sub === 'add' || sub === 'stage') sawAdd = true;
    if (sub === 'commit') {
      let all = sawAdd || rest.includes('--all') || rest.includes('--include') || rest.includes('--only');
      for (let k = 0; k < rest.length; k++) {
        const a = rest[k];
        if (a.startsWith('--')) {
          if (OPT_WITH_VALUE.has(a)) k++;
          continue;
        }
        if (a.startsWith('-')) {
          if (/^-[A-Za-z]*a[A-Za-z]*$/.test(a)) all = true; // -a, -am
          if (/^-[A-Za-z]*[mFCcS]$/.test(a)) k++; // value in the next token (e.g. -m "x", -am "x")
          continue;
        }
        all = true; // explicit paths: `git commit file` commits the working tree state of file
      }
      actions.push({ kind: 'commit', cwd: segCwd, all, untracked: sawAdd });
    } else if (sub === 'push') {
      actions.push({ kind: 'push', cwd: segCwd, allBranches: rest.includes('--all') || rest.includes('--mirror') });
    }
  }
  return actions;
}

function gitleaksAvailable() {
  const r = runProc('gitleaks', ['version'], { timeout: 10000 });
  return !r.missing && r.code === 0;
}

function describe(findings) {
  const lines = [];
  for (const s of findings.secrets) lines.push(`- ${s.commit ? `commit ${s.commit} : ` : ''}${s.file}:${s.line} — ${s.kind}`);
  for (const f of findings.files) lines.push(`- ${f.commit ? `commit ${f.commit} : ` : ''}${f.file} — fichier secret interdit dans le dépôt`);
  return lines;
}

function scanUntracked(cwd) {
  const out = { secrets: [], files: [] };
  const r = git(cwd, ['ls-files', '--others', '--exclude-standard']);
  if (r.code !== 0) return out;
  for (const f of r.stdout.split('\n').map((x) => x.trim()).filter(Boolean)) {
    if (protectedKind(f) === 'secret') out.files.push({ file: f, commit: '' });
    try {
      const abs = path.join(cwd, f);
      if (fs.statSync(abs).size > MAX_UNTRACKED_BYTES) continue;
      fs.readFileSync(abs, 'utf8').split('\n').forEach((line, idx) => {
        for (const s of findSecrets(line)) out.secrets.push({ file: f, line: idx + 1, kind: s.kind, commit: '' });
      });
    } catch {
      /* unreadable: ignore */
    }
  }
  return out;
}

function merge(a, b) {
  return { secrets: a.secrets.concat(b.secrets), files: a.files.concat(b.files) };
}

function audit(top) {
  if (!fs.existsSync(path.join(top, 'package-lock.json'))) return { status: 'skipped', list: [] };
  const cli = npmCliPath();
  const r = cli
    ? runNode(cli, ['audit', '--omit=dev', '--audit-level=high', '--json'], { cwd: top, timeout: 30000 })
    : runProc('npm', ['audit', '--omit=dev', '--audit-level=high', '--json'], { cwd: top, timeout: 30000, shell: true });
  if (r.missing) return { status: 'skipped', list: [] };
  if (r.timedOut) return { status: 'unavailable', reason: 'délai dépassé', list: [] };
  return parseAudit(r.stdout || r.stderr);
}

runHook({ name: 'pre-commit-guard', event: 'PreToolUse', failMode: 'closed' }, (input, ctx) => {
  if (!isShellTool(input.tool_name)) return undefined;
  const command = shellCommand(input);
  if (!/\bgit\b/i.test(command) || !/\b(commit|push)\b/i.test(command)) return undefined;
  const actions = findGitActions(command, ctx.cwd || ctx.root);
  if (!actions.length) return undefined;

  let findings = { secrets: [], files: [] };
  const extra = [];
  const tops = new Set();
  let leaksTool = null;
  for (const act of actions) {
    const top = git(act.cwd, ['rev-parse', '--show-toplevel']);
    if (top.missing) return undefined; // git not installed
    if (top.code !== 0) continue; // not a repository
    const root = top.stdout.trim();
    tops.add(root);
    const diffArgs = ['--no-pager', 'diff', '--no-color', '--no-ext-diff', '--no-textconv', '-U0'];
    if (act.kind === 'commit') {
      findings = merge(findings, scanDiff(gitScan(root, [...diffArgs, '--cached']).stdout));
      if (act.all) {
        let r = gitScan(root, [...diffArgs, 'HEAD']);
        if (r.code !== 0) r = gitScan(root, diffArgs); // no commit yet
        findings = merge(findings, scanDiff(r.stdout));
      }
      if (act.untracked) findings = merge(findings, scanUntracked(root));
      if (leaksTool === null) leaksTool = gitleaksAvailable();
      if (leaksTool) {
        const g = runProc('gitleaks', ['protect', '--staged', '--redact', '--no-banner', '--exit-code', '1'], { cwd: root, timeout: 25000 });
        if (g.timedOut) throw new Error('gitleaks a dépassé le délai : analyse incomplète');
        if (g.code === 1) extra.push(`gitleaks a détecté des secrets (sortie masquée) :\n${tail(`${g.stdout}\n${g.stderr}`, 15)}`);
      }
    } else {
      const logArgs = ['--no-pager', 'log', '-p', '--no-color', '--no-ext-diff', '--no-textconv', '-U0', '--format=commit:%H'];
      const up = git(root, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']);
      const head = git(root, ['rev-parse', '--verify', 'HEAD']);
      if (head.code !== 0) continue; // nothing to push
      let range = ['HEAD'];
      if (act.allBranches) range = ['--all'];
      else if (up.code === 0) range = ['@{u}..HEAD'];
      findings = merge(findings, scanDiff(gitScan(root, [...logArgs, ...range]).stdout));
      if (leaksTool === null) leaksTool = gitleaksAvailable();
      if (leaksTool) {
        const opts = range[0] === 'HEAD' ? [] : range[0] === '--all' ? [] : ['--log-opts', range[0]];
        const g = runProc('gitleaks', ['detect', '--redact', '--no-banner', '--exit-code', '1', ...opts], { cwd: root, timeout: 30000 });
        if (g.timedOut) throw new Error('gitleaks a dépassé le délai : analyse incomplète');
        if (g.code === 1) extra.push(`gitleaks a détecté des secrets (sortie masquée) :\n${tail(`${g.stdout}\n${g.stderr}`, 15)}`);
      }
    }
  }
  if (!tops.size) return undefined; // no repository: nothing to guard

  const lines = describe(findings);
  const problems = [];
  if (lines.length) {
    const seen = [...new Set(lines)].slice(0, 30);
    problems.push(`Secrets ou fichiers interdits dans ce qui part (valeurs masquées, jamais recopiées) :\n${seen.join('\n')}`);
  }
  problems.push(...extra);

  let auditAsk = '';
  for (const top of tops) {
    const a = audit(top);
    if (a.status === 'vulns') {
      problems.push(`npm audit : vulnérabilités hautes/critiques (dépendances de production) :\n${a.list.slice(0, 15).map((v) => `- ${v.name} (${v.severity}) ${v.title}`).join('\n')}`);
    } else if (a.status === 'unavailable') {
      auditAsk = `npm audit impossible (${a.reason}).`;
    }
  }
  if (problems.length) {
    return deny(`${problems.join('\n\n')}\n\nCLAUDE.md § 5 : aucun secret dans le dépôt. Retire-les du diff (git restore --staged / suppression), fais tourner la clé exposée, puis recommence.`);
  }
  if (auditAsk) return ask(`${auditAsk} Aucun secret détecté. Autoriser le commit/push sans audit des dépendances ?`);
  return undefined;
});
