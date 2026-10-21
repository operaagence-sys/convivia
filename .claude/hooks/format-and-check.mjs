// Hook 4 — PostToolUse (Edit|Write|MultiEdit). Prettier --write + ESLint --fix
// on the edited file, via the project's local binaries. Records changed code
// files for the quick-tests hook. Quality hook: fails open.
import fs from 'node:fs';
import path from 'node:path';
import { runHook, block, info, toolPath, addChangedFiles, isCodeFile, localBin, BINS, runNode, head } from './lib/common.mjs';

const FORMAT_EXTS = /\.(ts|tsx|js|jsx|mjs|cjs|json|css|md)$/i;
const LINT_EXTS = /\.(ts|tsx|js|jsx|mjs|cjs)$/i;
const NO_CONFIG = /couldn'?t find an eslint\.config|no eslint configuration found|could not find config file|eslint configuration/i;

function eslintMajor(root) {
  try {
    return parseInt(JSON.parse(fs.readFileSync(path.join(root, 'node_modules/eslint/package.json'), 'utf8')).version, 10) || 0;
  } catch {
    return 0;
  }
}

runHook({ name: 'format-and-check', event: 'PostToolUse', failMode: 'open' }, (input, ctx) => {
  const fp = toolPath(input.tool_input);
  if (!fp) return undefined;
  const rel = ctx.rel(fp);
  const relRaw = ctx.relRaw(fp);
  if (rel.startsWith('/') || /^[a-z]:\//.test(rel) || rel.startsWith('../')) return undefined; // outside the project
  if (!FORMAT_EXTS.test(rel)) return undefined;
  if (/(^|\/)(node_modules|\.next|\.vercel|\.turbo|coverage)\//.test(rel)) return undefined;
  if (rel.startsWith('.claude/')) return undefined;
  if (/\.md$/.test(rel) && rel.startsWith('docs/')) return undefined; // business documents are never rewritten
  if (/(^|\/)(package-lock\.json|pnpm-lock\.yaml)$/.test(rel)) return undefined;

  const abs = path.join(ctx.root, relRaw);
  if (!fs.existsSync(abs)) return undefined;

  if (isCodeFile(rel) && input.session_id) {
    try {
      addChangedFiles(input.session_id, [relRaw]);
    } catch {
      /* state is best effort */
    }
  }

  if (!fs.existsSync(path.join(ctx.root, 'package.json'))) return undefined;

  const notes = [];
  const prettier = localBin(ctx.root, BINS.prettier);
  if (prettier) {
    const r = runNode(prettier, ['--write', '--ignore-unknown', abs], { cwd: ctx.root, timeout: 25000 });
    if (r.timedOut) notes.push('Prettier a dépassé le délai.');
    else if (r.code !== 0 && r.code !== null) {
      // A syntax error is useful to Claude, but not blocking by itself.
      notes.push(`Prettier n'a pas pu formater ${relRaw} : ${head((r.stderr || r.stdout).trim(), 3)}`);
    }
  }

  const eslint = localBin(ctx.root, BINS.eslint);
  if (eslint && LINT_EXTS.test(rel)) {
    const args = ['--fix'];
    if (eslintMajor(ctx.root) >= 9) args.push('--no-warn-ignored');
    args.push(abs);
    const r = runNode(eslint, args, { cwd: ctx.root, timeout: 30000 });
    const out = `${r.stdout}\n${r.stderr}`;
    if (r.timedOut) notes.push('ESLint a dépassé le délai.');
    else if (r.code === 1) {
      return block(`ESLint signale des erreurs restantes dans ${relRaw} (20 premières lignes) :\n${head(out.trim(), 20)}\nCorrige-les avant de continuer.`);
    } else if (r.code !== 0 && r.code !== null && !NO_CONFIG.test(out)) {
      notes.push(`ESLint a échoué (code ${r.code}) : ${head(out.trim(), 3)}`);
    }
  }
  return notes.length ? info(notes.join(' ')) : undefined;
});
