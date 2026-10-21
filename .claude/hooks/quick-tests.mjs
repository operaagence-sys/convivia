// Hook 7 — Stop and SubagentStop (build agents). Fast checks when code files
// changed: `test:quick` script, else tsc + ESLint + vitest related.
// Budget 90 s. Quality hook: fails open (a missing tool is never a block).
import fs from 'node:fs';
import path from 'node:path';
import {
  runHook, block, info, readChangedFiles, clearChangedFiles, readToolUses, normalizePath, relPath, projectRoot, BUILD_AGENTS,
  isCodeFile, localBin, BINS, runNode, runProc, npmCliPath, tail,
} from './lib/common.mjs';

const BUDGET_MS = 90000;

runHook({ name: 'quick-tests', event: 'Stop', failMode: 'open' }, (input) => {
  const isSub = input.hook_event_name === 'SubagentStop' || !!input.agent_transcript_path;
  const root = projectRoot(input);
  let files = [];
  if (isSub) {
    if (!BUILD_AGENTS.includes(String(input.agent_type || ''))) return undefined;
    const set = new Map();
    for (const { name, input: ti } of readToolUses(input.agent_transcript_path)) {
      if (!['Edit', 'Write', 'MultiEdit', 'NotebookEdit'].includes(name)) continue;
      const fp = ti.file_path || ti.notebook_path;
      if (!fp) continue;
      const rel = normalizePath(fp, root);
      if (rel.startsWith('/') || /^[a-z]:\//.test(rel) || rel.startsWith('.claude/')) continue;
      if (isCodeFile(rel)) set.set(rel, relPath(fp, root));
    }
    files = [...set.values()];
  } else {
    files = readChangedFiles(input.session_id);
  }
  files = files.filter((f) => fs.existsSync(path.join(root, f)));
  if (!files.length) return undefined;

  const pkgPath = path.join(root, 'package.json');
  if (!fs.existsSync(pkgPath)) return undefined;
  let pkg;
  try {
    pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  } catch {
    return info('package.json illisible : tests rapides ignorés.');
  }

  const t0 = Date.now();
  const left = () => Math.max(1000, BUDGET_MS - (Date.now() - t0));
  const failures = [];
  const notes = [];

  if (pkg.scripts && pkg.scripts['test:quick']) {
    const cli = npmCliPath();
    const r = cli
      ? runNode(cli, ['run', 'test:quick', '--silent'], { cwd: root, timeout: BUDGET_MS })
      : runProc('npm', ['run', 'test:quick', '--silent'], { cwd: root, timeout: BUDGET_MS, shell: true });
    if (r.missing) return undefined;
    if (r.timedOut) notes.push(`« npm run test:quick » a dépassé ${BUDGET_MS / 1000} s.`);
    else if (r.code !== 0) failures.push(`npm run test:quick (code ${r.code}) :\n${tail(`${r.stdout}\n${r.stderr}`, 40)}`);
  } else {
    const tsc = localBin(root, BINS.tsc);
    if (tsc && fs.existsSync(path.join(root, 'tsconfig.json'))) {
      const r = runNode(tsc, ['--noEmit', '--pretty', 'false'], { cwd: root, timeout: left() });
      if (r.timedOut) notes.push('tsc a dépassé le budget de temps.');
      else if (r.code !== 0) failures.push(`tsc --noEmit :\n${tail(r.stdout || r.stderr, 30)}`);
    }
    const eslint = localBin(root, BINS.eslint);
    if (eslint && Date.now() - t0 < BUDGET_MS) {
      const r = runNode(eslint, ['--no-warn-ignored', ...files], { cwd: root, timeout: left() });
      const out = `${r.stdout}\n${r.stderr}`;
      if (r.timedOut) notes.push('ESLint a dépassé le budget de temps.');
      else if (r.code === 1) failures.push(`ESLint :\n${tail(out, 30)}`);
    }
    const vitest = localBin(root, BINS.vitest);
    if (vitest && Date.now() - t0 < BUDGET_MS) {
      const r = runNode(vitest, ['related', '--run', '--passWithNoTests', ...files], { cwd: root, timeout: left() });
      if (r.timedOut) notes.push('Vitest a dépassé le budget de temps.');
      else if (r.code !== 0 && r.code !== null) failures.push(`vitest related :\n${tail(`${r.stdout}\n${r.stderr}`, 40)}`);
    }
  }

  if (failures.length) {
    const text = `Tests rapides en échec (${files.length} fichier(s) modifié(s)) :\n${failures.join('\n\n')}`;
    if (input.stop_hook_active) return info(text);
    return block(`${text}\nCorrige avant de terminer.`);
  }
  if (!isSub) {
    try {
      clearChangedFiles(input.session_id);
    } catch {
      /* ignore */
    }
  }
  return notes.length ? info(notes.join(' ')) : undefined;
});
