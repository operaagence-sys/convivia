// Hook 13 — PreToolUse (Bash|PowerShell|Monitor). Closes the side doors of the shell:
// the PowerShell tool and the interpreters that bypass the Bash analysis, nested
// Claude Code sessions (no hooks), persistent environment changes, remote code.
import { runHook, deny, isShellTool, shellCommand } from './lib/common.mjs';
import { allSegments, commandOf, PS_PROGRAMS } from './lib/shell.mjs';

const WHY = ' Utilise l\'outil Bash (Git Bash) : les hooks de sécurité (secrets, clés live, base distante, suppressions) n\'analysent que lui. Si c\'est vraiment nécessaire, c\'est le porteur du projet qui lance la commande dans son propre terminal.';

// Programs an agent never needs and that escape the analysis of the other hooks.
const DENIED_PROGRAMS = new Map([
  ...[...PS_PROGRAMS].map((p) => [p, 'PowerShell (non surveillé)']),
  ['cmd', 'cmd.exe (syntaxe non analysée)'],
  ['wsl', 'WSL (un autre système, hors des hooks)'],
  ['wscript', 'Windows Script Host'],
  ['cscript', 'Windows Script Host'],
  ['mshta', 'mshta'],
  ['rundll32', 'rundll32'],
  ['regsvr32', 'regsvr32'],
  ['bitsadmin', 'bitsadmin'],
  ['certutil', 'certutil'],
  ['wmic', 'wmic'],
  ['schtasks', 'tâche planifiée'],
  ['crontab', 'tâche planifiée'],
  ['at', 'tâche planifiée'],
  ['setx', 'variable d\'environnement persistante (peut piéger les hooks : NODE_OPTIONS…)'],
  ['reg', 'registre Windows'],
  ['claude', 'session Claude Code imbriquée (sans hooks ni permissions)'],
  ['claude-code', 'session Claude Code imbriquée (sans hooks ni permissions)'],
]);
const INTERPRETERS = new Set(['node', 'nodejs', 'python', 'python3', 'py', 'deno', 'bun', 'perl', 'ruby', 'php']);
const INLINE_SPAWN_PS = /\b(?:powershell|pwsh)(?:\.exe)?\b|WindowsPowerShell/i;
const PIPE_TO_SHELL = /\b(?:curl|wget|iwr|invoke-webrequest|irm)\b[^|;&\n]*\|\s*(?:sudo\s+)?(?:ba|z|da|k|c)?sh\b/i;

export function shellProblems(command) {
  const reasons = [];
  for (const seg of allSegments(command)) {
    const c = commandOf(seg.words);
    if (!c) continue;
    const why = DENIED_PROGRAMS.get(c.prog);
    if (why) reasons.push(`« ${c.prog} » : ${why}`);
    const pkgRunner = c.runners.find((r) => /claude-code/i.test([...r.specs, r.cmd || ''].join(' ')));
    if (pkgRunner) reasons.push('« claude-code » lancé via un exécuteur de paquet : session imbriquée sans hooks');
    if (INTERPRETERS.has(c.prog) && INLINE_SPAWN_PS.test(c.args.join(' '))) reasons.push(`« ${c.prog} » lance PowerShell depuis du code en ligne`);
    // `start powershell`, `explorer powershell`: the program is an argument of a launcher
    if (['start', 'explorer', 'runas', 'invoke-item', 'ii', 'start-process', 'saps'].includes(c.prog) && c.args.some((a) => PS_PROGRAMS.has(a.toLowerCase().replace(/\.exe$/, '')))) {
      reasons.push('PowerShell lancé via un lanceur');
    }
  }
  if (PIPE_TO_SHELL.test(command)) reasons.push('code distant exécuté directement (curl | sh)');
  return [...new Set(reasons)];
}

runHook({ name: 'guard-shell', event: 'PreToolUse', failMode: 'closed' }, (input) => {
  const tool = String(input.tool_name || '');
  if (tool === 'PowerShell') return deny(`L'outil PowerShell est désactivé pour les agents.${WHY}`);
  if (!isShellTool(tool)) return undefined;
  const reasons = shellProblems(shellCommand(input));
  if (!reasons.length) return undefined;
  return deny(`Commande refusée : ${reasons.join(' ; ')}.${WHY}`);
});
