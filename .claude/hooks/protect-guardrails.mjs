// Hook 8 — PreToolUse (Edit|Write|MultiEdit|NotebookEdit|Bash|PowerShell|Monitor).
//  - DENY: whatever switches the hooks off — `disableAllHooks`, writes to
//    .claude/settings.local.json or to the user-level Claude Code settings,
//    environment tricks that inject code into every hook (NODE_OPTIONS...).
//    An agent never has to do this; the project owner edits these files himself.
//  - ASK: any change to the guardrails themselves (.claude/settings.json,
//    .claude/hooks/**, git hooks / git config, package-manager config): the
//    devops-engineer may have to, the project owner confirms.
import { runHook, ask, deny, toolPath, addedContent, WRITE_TOOLS, toSlash, canonPath, relPath, isShellTool, shellCommand } from './lib/common.mjs';
import { allSegments, commandOf, inlineCodeOf } from './lib/shell.mjs';

const WHY = ' Ces fichiers sont les garde-fous du projet : confirme que le porteur du projet le demande.';
const WHY_DENY = ' Aucun agent ne désactive ni ne contourne les hooks : si c\'est vraiment nécessaire, le porteur du projet le fait lui-même, hors de la session, dans son éditeur ou son terminal.';

const ABS = /^(?:[a-z]:)?\//;

/** Canonical lowercase path (project-relative, or absolute outside the project) -> 'deny' | 'ask' | null. */
function guardKind(rel) {
  const r = rel.replace(/\/+$/, '');
  if (ABS.test(r)) {
    // Outside the project: the user-level Claude Code settings switch the hooks off.
    return /\/\.claude\/settings[^/]*\.json$/.test(r) || /\/\.claude\.json$/.test(r) ? 'deny' : null;
  }
  if (r === '.claude/settings.local.json') return 'deny';
  if (r === '.claude/settings.json' || r === '.claude/hooks' || r.startsWith('.claude/hooks/')) return 'ask';
  if (r === '.git/config' || r === '.git/hooks' || r.startsWith('.git/hooks/') || r === '.git/info/attributes') return 'ask';
  if (['.gitattributes', '.gitmodules', '.npmrc', '.yarnrc', '.yarnrc.yml', '.pnpmfile.cjs', 'bunfig.toml'].includes(r)) return 'ask';
  if (r === '.husky' || r.startsWith('.husky/')) return 'ask';
  return null;
}

/** Guarded, or a directory / glob that contains guarded files (`.claude`, `.claude/*`, `.claude/hooks/*`, `.git/*`). */
function guardKindPattern(rel) {
  const k = guardKind(rel);
  if (k) return k;
  const r = rel.replace(/\/+$/, '');
  if (ABS.test(r)) return /(^|\/)\.claude$/.test(r) ? 'deny' : null; // someone's .claude directory outside the project
  if (r === '.claude' || r === '.git') return 'ask';
  if (/^\.claude\/[^/]*[*?[]/.test(r) || /^\.git\/[^/]*[*?[]/.test(r)) return 'ask';
  return null;
}

const worst = (a, b) => (a === 'deny' || b === 'deny' ? 'deny' : a || b);

const WRITERS = new Set([
  'rm', 'rmdir', 'rd', 'del', 'erase', 'mv', 'move', 'cp', 'copy', 'xcopy', 'robocopy', 'tee', 'dd', 'install', 'ln', 'touch',
  'chmod', 'chown', 'truncate', 'shred', 'patch', 'unlink', 'ren', 'rename', 'rename-item', 'remove-item', 'ri', 'set-content', 'sc',
  'add-content', 'ac', 'out-file', 'copy-item', 'move-item', 'new-item', 'ni', 'clear-content', 'attrib', 'icacls', 'takeown', 'unzip', '7z',
  'rsync', 'curl', 'wget', 'tar', 'zip', 'ed', 'ex', 'cpio', 'git-apply',
]);
const INTERPRETERS = new Set(['node', 'nodejs', 'python', 'python3', 'py', 'deno', 'bun', 'perl', 'ruby', 'php']);
const GUARD_TEXT = /\.claude\/(settings(\.local)?\.json|hooks(\/|\b))|\.git\/(hooks|config)\b|integrity\.json|seal\.mjs/i;
const SWITCH_TEXT = /settings\.local\.json|\.claude\/settings|\.claude\.json/i;
const GIT_WRITE = new Set(['checkout', 'restore', 'rm', 'mv', 'reset', 'clean', 'apply', 'am', 'stash', 'switch']);
const STASH_READ = new Set(['list', 'show']);
// Code injected in every hook / every tool through the environment.
const ENV_INJECTION = /(?:^|[\s;&|("'`{])(?:export\s+|set\s+|setx\s+|env\s+)?(?:BASH_ENV|LD_PRELOAD|DYLD_INSERT_LIBRARIES|CLAUDE_CONFIG_DIR)=|NODE_OPTIONS\s*=[^;&|\n]*(?:--(?:require|import|loader|experimental-loader|eval)|(?:^|[\s="'])-r\b)/;
const WRITING_PROGS = new Set([...WRITERS, 'sed', 'perl', 'node', 'nodejs', 'python', 'python3', 'py', 'deno', 'bun', 'ruby', 'php', 'tee', 'awk']);

function gitSubcommand(args) {
  let i = 0;
  while (i < args.length && args[i].startsWith('-')) i += ['-C', '-c', '--git-dir', '--work-tree', '--namespace'].includes(args[i]) ? 2 : 1;
  return { sub: (args[i] || '').toLowerCase(), rest: args.slice(i + 1) };
}

function checkShell(command, ctx) {
  if (ENV_INJECTION.test(command)) return deny(`Variable d'environnement qui injecterait du code dans les hooks ou dans Claude Code (NODE_OPTIONS --require/--import, BASH_ENV, LD_PRELOAD, CLAUDE_CONFIG_DIR).${WHY_DENY}`);
  let cwd = ctx.cwd;
  const rel = (p) => relPath(p, ctx.root, cwd).toLowerCase();
  if (/disableAllHooks/i.test(command)) {
    // Reading or searching for the word is harmless; writing it (redirection, writer, interpreter) is not.
    const writes = allSegments(command).some((sg) => sg.redirs.some((r) => r.op === '>' || r.op === '>>') || WRITING_PROGS.has((commandOf(sg.words) || {}).prog));
    if (writes) return deny(`La commande écrit disableAllHooks (désactivation des hooks).${WHY_DENY}`);
  }
  let result = null;
  const note = (kind, text) => {
    if (kind === 'deny') result = { type: 'deny', text };
    else if (!result) result = { type: 'ask', text };
  };
  for (const seg of allSegments(command)) {
    for (const r of seg.redirs) {
      if (r.target && (r.op === '>' || r.op === '>>')) {
        const k = guardKind(rel(r.target));
        if (k === 'deny') note('deny', `Redirection vers ${r.target} (interrupteur des hooks).${WHY_DENY}`);
        else if (k) note('ask', `Redirection vers ${r.target}.${WHY}`);
      }
    }
    const c = commandOf(seg.words);
    if (!c) continue;
    // `cd .claude && rm -rf hooks`: follow the working directory.
    if (['cd', 'pushd', 'set-location', 'chdir'].includes(c.prog)) {
      const t = c.args.find((a) => !a.startsWith('-'));
      if (t) cwd = canonPath(t, ctx.root, cwd);
      continue;
    }
    let touches = null;
    for (const a of c.args) {
      const cands = [a];
      const eq = a.indexOf('=');
      if (eq > 0) cands.push(a.slice(eq + 1));
      for (const v of cands) if (v) touches = worst(touches, guardKindPattern(rel(v)));
    }
    const gsub = c.prog === 'git' ? gitSubcommand(c.args) : null;
    if (gsub && gsub.sub === 'stash' && !STASH_READ.has((gsub.rest.find((a) => !a.startsWith('-')) || '').toLowerCase())) {
      note('ask', `git stash retire les modifications locales, hooks et configuration compris.${WHY}`);
    }
    if (gsub && ['apply', 'am'].includes(gsub.sub)) note('ask', `git ${gsub.sub} applique un correctif dont le contenu peut modifier les hooks.${WHY}`);
    if (c.prog === 'patch') note('ask', `patch applique un correctif dont le contenu peut modifier les hooks.${WHY}`);
    if (touches && gsub && GIT_WRITE.has(gsub.sub)) note(touches, `Commande git qui peut modifier la configuration des hooks.${WHY}`);
    if (touches && c.prog === 'sed' && c.args.some((a) => a === '-i' || /^-[a-z]*i/i.test(a) || a.startsWith('--in-place'))) note(touches, `sed -i sur la configuration des hooks.${WHY}`);
    if (touches && c.prog === 'perl' && c.args.some((a) => /^-[a-z]*i/i.test(a))) note(touches, `perl -i sur la configuration des hooks.${WHY}`);
    if (touches && WRITERS.has(c.prog)) note(touches, `Commande « ${c.prog} » sur la configuration des hooks.${WHY}`);
    if (c.prog === 'node' && c.args.some((a) => /(^|[\\/])seal\.mjs$/.test(a))) note('ask', `Scellement des hooks (seal.mjs) : réservé au porteur du projet.${WHY}`);
    if (INTERPRETERS.has(c.prog)) {
      const code = toSlash(inlineCodeOf(seg, c));
      if (SWITCH_TEXT.test(code)) note('deny', `Code en ligne qui référence les réglages de Claude Code (interrupteur des hooks).${WHY_DENY}`);
      else if (c.args.some((a) => /^(-e|-c|-p|-pe|-ne|--eval|--print|-command|-)$/i.test(a)) || seg.redirs.some((r) => r.body) ) {
        if (GUARD_TEXT.test(code)) note('ask', `Code en ligne qui référence la configuration des hooks.${WHY}`);
      }
    }
  }
  if (!result) return undefined;
  return result.type === 'deny' ? deny(result.text) : ask(result.text);
}

runHook({ name: 'protect-guardrails', event: 'PreToolUse', failMode: 'closed' }, (input, ctx) => {
  const tool = input.tool_name;
  const ti = input.tool_input || {};
  if (isShellTool(tool)) return checkShell(shellCommand(input), ctx);
  if (!WRITE_TOOLS.has(tool)) return undefined;
  const fp = toolPath(ti);
  const content = addedContent(tool, ti);
  // The documentation of the hooks and their tests may name the setting; nothing else may write it.
  const docOnly = !!fp && /^\.claude\/hooks\/(?:readme\.md|tests\/)/.test(ctx.rel(fp));
  if (!docOnly && new RegExp('disable' + 'AllHooks', 'i').test(content)) return deny(`Le contenu introduit le réglage qui désactive les hooks.${WHY_DENY}`);
  if (fp) {
    const k = guardKind(ctx.rel(fp));
    if (k === 'deny') return deny(`Modification de ${ctx.relRaw(fp)} refusée : ce fichier peut désactiver les hooks.${WHY_DENY}`);
    if (k === 'ask') return ask(`Modification de ${ctx.relRaw(fp)}.${WHY}`);
  }
  return undefined;
});
