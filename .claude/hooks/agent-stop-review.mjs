// Hook 5 — SubagentStop. Checks what a sub-agent wrote against its role
// (transcript JSONL), and lints / type-checks its files. Quality hook: fails open.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  runHook, block, info, readToolUses, normalizePath, relPath, projectRoot, KNOWN_AGENTS, BUILD_AGENTS, isCodeFile, isTestFile,
  protectedKind, localBin, BINS, runNode, head, toSlash,
} from './lib/common.mjs';
import { allSegments, commandOf, hasShortFlag } from './lib/shell.mjs';

const READ_ONLY = new Set(['product-manager', 'security-reviewer']);
const NO_SUPABASE = new Set(['ui-designer', 'ux-writer', 'template-designer']);
const NULL_TARGET = /^(\/dev\/null|nul|\$null|&\d+|\d+|-)$/i;
const INLINE_WRITE = /open\([^)]*['"][wax]\+?b?['"]|write_text|write_bytes|writeFile|appendFile|createWriteStream|fs\.write|\.write\(|File\.WriteAll|shutil\.(copy|move)|Set-Content|Out-File|Add-Content/i;

/** Files written by a Bash command: [{targets: string[], how: string}] */
export function bashWrites(command) {
  const out = [];
  for (const seg of allSegments(command)) {
    for (const r of seg.redirs) {
      if ((r.op === '>' || r.op === '>>') && r.target && !NULL_TARGET.test(r.target)) out.push({ targets: [r.target], how: `redirection ${r.op}` });
    }
    const c = commandOf(seg.words);
    if (!c) continue;
    const pos = c.args.filter((a) => !a.startsWith('-'));
    switch (c.prog) {
      case 'tee':
        if (pos.length) out.push({ targets: pos.filter((p) => !NULL_TARGET.test(p)), how: 'tee' });
        break;
      case 'sed':
        if (c.args.some((a) => a === '-i' || /^-[a-z]*i/i.test(a) || a.startsWith('--in-place'))) out.push({ targets: pos.slice(1), how: 'sed -i' });
        break;
      case 'out-file':
      case 'set-content':
      case 'add-content':
      case 'sc':
      case 'ac': {
        const i = c.args.findIndex((a) => /^-(file)?path$/i.test(a));
        const t = i >= 0 ? c.args[i + 1] : pos[0];
        out.push({ targets: t ? [t] : [], how: c.prog });
        break;
      }
      case 'cp':
      case 'mv':
      case 'copy':
      case 'move':
      case 'copy-item':
      case 'move-item':
        if (pos.length >= 2) out.push({ targets: [pos[pos.length - 1]], how: c.prog });
        break;
      case 'touch':
      case 'new-item':
      case 'ni':
        out.push({ targets: pos.slice(0, 1), how: c.prog });
        break;
      case 'python':
      case 'python3':
      case 'py':
      case 'node':
      case 'nodejs':
      case 'deno':
      case 'bun':
      case 'perl':
      case 'ruby':
        if (hasShortFlag(c.args, 'c') || hasShortFlag(c.args, 'e') || c.args.includes('--eval') || c.args.includes('-p')) {
          if (INLINE_WRITE.test(c.args.join(' '))) out.push({ targets: [], how: `${c.prog} inline avec écriture` });
        }
        break;
      default:
    }
  }
  // Heredoc-fed interpreters / PowerShell one-liners are covered by the raw check below.
  if (!out.length && /\b(Out-File|Set-Content|Add-Content)\b/i.test(command)) out.push({ targets: [], how: 'cmdlet PowerShell' });
  return out;
}

function violationsFor(agent, rel) {
  const v = [];
  if (READ_ONLY.has(agent)) v.push('cet agent est en lecture seule');
  if (agent === 'conventions-keeper' && rel !== 'docs/09-conventions.md') v.push('seul docs/09-conventions.md est autorisé');
  if (agent === 'qa-tester' && !(isTestFile(rel) || rel.startsWith('docs/test-checklist'))) v.push('seuls les fichiers de test sont autorisés');
  if (agent !== 'devops-engineer') {
    if (rel.startsWith('.claude/')) v.push('.claude/** est réservé au devops-engineer');
    if (/(^|\/)\.env/.test(rel) || protectedKind(rel) === 'secret') v.push('fichiers .env* interdits');
  }
  if (NO_SUPABASE.has(agent) && rel.startsWith('supabase/')) v.push('supabase/** est hors de son périmètre');
  return v;
}

runHook({ name: 'agent-stop-review', event: 'SubagentStop', failMode: 'open' }, (input) => {
  const agent = String(input.agent_type || '');
  if (!agent || !KNOWN_AGENTS.includes(agent)) return undefined;
  if (!input.agent_transcript_path) return undefined;
  const root = projectRoot(input);
  const tmpRoots = [os.tmpdir(), input.scratchpad_dir].filter(Boolean).map((p) => toSlash(p).toLowerCase().replace(/\/+$/, ''));
  const isTemp = (abs) => {
    const r = normalizePath(abs, root);
    if (!(r.startsWith('/') || /^[a-z]:\//.test(r))) return false; // inside the project: never exempt
    const s = toSlash(abs).toLowerCase();
    return s.startsWith('/tmp/') || tmpRoots.some((t) => s.startsWith(t + '/'));
  };

  const files = new Map(); // rel (lowercase) -> relRaw
  const problems = [];
  const bashNotes = [];
  for (const { name, input: ti } of readToolUses(input.agent_transcript_path)) {
    if (['Edit', 'Write', 'MultiEdit', 'NotebookEdit'].includes(name)) {
      const fp = ti.file_path || ti.notebook_path;
      if (!fp || isTemp(fp)) continue;
      const rel = normalizePath(fp, root);
      if (rel.startsWith('/') || /^[a-z]:\//.test(rel)) continue; // outside the project
      files.set(rel, relPath(fp, root));
    } else if (name === 'Bash') {
      for (const w of bashWrites(String(ti.command || ''))) {
        const targets = w.targets.filter((t) => !isTemp(t));
        if (w.targets.length && !targets.length) continue;
        if (!targets.length) {
          bashNotes.push(`écriture par commande Bash (${w.how}), cible inconnue`);
          continue;
        }
        for (const t of targets) {
          const rel = normalizePath(t, root);
          bashNotes.push(`écriture par commande Bash (${w.how}) vers ${relPath(t, root)} : préfère les outils Edit/Write`);
          for (const reason of violationsFor(agent, rel)) problems.push(`${relPath(t, root)} (via Bash) : ${reason}`);
        }
      }
    }
  }
  for (const [rel, raw] of files) {
    for (const reason of violationsFor(agent, rel)) problems.push(`${raw} : ${reason}`);
  }
  problems.push(...[...new Set(bashNotes)]);

  // Lint + types for construction agents
  if (BUILD_AGENTS.includes(agent) && fs.existsSync(path.join(root, 'package.json'))) {
    const codeFiles = [...files.entries()].filter(([rel]) => isCodeFile(rel) && !rel.startsWith('.claude/')).map(([, raw]) => raw)
      .filter((raw) => fs.existsSync(path.join(root, raw)));
    if (codeFiles.length) {
      const eslint = localBin(root, BINS.eslint);
      if (eslint) {
        const r = runNode(eslint, ['--no-warn-ignored', ...codeFiles], { cwd: root, timeout: 25000 });
        const out = `${r.stdout}\n${r.stderr}`;
        if (r.code === 1) problems.push(`ESLint :\n${head(out.trim(), 20)}`);
      }
      const tsc = localBin(root, BINS.tsc);
      if (tsc && fs.existsSync(path.join(root, 'tsconfig.json'))) {
        const r = runNode(tsc, ['--noEmit', '--pretty', 'false'], { cwd: root, timeout: 40000 });
        if (r.code === 1 || r.code === 2) {
          const mine = (r.stdout || '').split('\n').filter((l) => codeFiles.some((f) => toSlash(l).includes(toSlash(f))));
          if (mine.length) problems.push(`tsc --noEmit :\n${mine.slice(0, 20).join('\n')}`);
        }
      }
    }
  }

  if (!problems.length) return undefined;
  const text = `Revue de fin de tâche de l'agent « ${agent} » : ${problems.length} point(s) à corriger ou à justifier.\n- ${problems.join('\n- ')}`;
  if (input.stop_hook_active) return info(text);
  return block(text + '\nCorrige ces points, ou explique en une phrase pourquoi ils sont légitimes.');
});
