// Hook 13 (guard-shell): one "denied" test per binary promised by the README,
// plus legitimate commands that must pass (including words that merely contain
// « at » or « reg »).
import test from 'node:test';
import assert from 'node:assert/strict';
import { run, bash } from './helpers.mjs';

const S = 'guard-shell.mjs';
const d = (command) => run(S, bash(command)).decision;

// binary -> a realistic invocation
const DENIED = {
  certutil: 'certutil -urlcache -f https://example.com/a.exe a.exe',
  wmic: 'wmic process call create "calc.exe"',
  schtasks: 'schtasks /create /tn x /tr calc.exe /sc daily',
  crontab: 'crontab -l',
  at: 'at now + 1 minute',
  mshta: 'mshta https://example.com/a.hta',
  wscript: 'wscript x.vbs',
  cscript: 'cscript //nologo x.js',
  rundll32: 'rundll32 user32.dll,LockWorkStation',
  regsvr32: 'regsvr32 /s x.dll',
  bitsadmin: 'bitsadmin /transfer j https://example.com/a a',
  reg: 'reg add HKCU\\Software\\X /v Y /d 1',
  cmd: 'cmd /c dir',
  wsl: 'wsl ls',
  setx: 'setx FOO bar',
  powershell: 'powershell -c ls',
  pwsh: 'pwsh -Command ls',
  claude: 'claude -p hi',
};

test('chaque binaire promis par le README est refusé', () => {
  for (const [bin, cmd] of Object.entries(DENIED)) {
    const r = run(S, bash(cmd));
    assert.equal(r.decision, 'deny', `${bin} : ${cmd}`);
    assert.ok(r.reason.includes(bin), `la raison cite « ${bin} »`);
  }
});

test('refusé aussi avec .exe, chemin complet, sudo/env, enchaînement et substitution', () => {
  const variants = [
    'certutil.exe -hashfile a SHA256', 'C:\\Windows\\System32\\reg.exe query HKLM', '/c/Windows/System32/wmic os get caption',
    'CERTUTIL -decode a b', 'echo ok && schtasks /query', 'ls; crontab -e', 'ls | at now', 'echo $(wmic cpu get name)', '`reg query HKCU`',
    'bash -c "certutil -urlcache -f http://x y"', 'env FOO=1 mshta x.hta', 'FOO=1 rundll32 a.dll,B', 'sudo crontab -e',
    'xargs wscript', "sh -c 'bitsadmin /list'",
  ];
  for (const c of variants) assert.equal(d(c), 'deny', c);
});

test('commandes légitimes -> rien', () => {
  const ok = [
    'git status', 'git log --oneline -5', 'node -v', 'node --test x', 'npm test', 'npm run build', 'npx vitest run', 'supabase db reset',
    'ls -la', 'cat README.md', 'echo at', 'echo reg', 'echo "schtasks and certutil are denied"', 'grep -r crontab docs', 'git commit -m "add reg and at notes"',
    // words that contain « at » or « reg » without being the command
    'cat file.txt', 'date', 'format-check', 'regenerate-types', 'register-user.sh', 'ls regression/', 'npm run regen', 'git checkout -b feature/at-risk',
    'node scripts/at.js', 'node reg.mjs', 'python3 attach.py', 'curl https://example.com/file -o file', 'echo hi | cat',
  ];
  for (const c of ok) assert.equal(d(c), 'none', c);
});

test('plusieurs occurrences du même programme : une seule raison', () => {
  const r = run(S, bash('certutil -h && certutil -h'));
  assert.equal(r.decision, 'deny');
  assert.equal(r.reason.match(/certutil/g).length >= 1, true);
  assert.equal(r.reason.split('« certutil »').length - 1, 1);
});

test('l\'outil PowerShell est refusé quel que soit son contenu', () => {
  assert.equal(run(S, { tool_name: 'PowerShell', tool_input: { command: 'Get-Date' } }).decision, 'deny');
});

test('échec fermé : entrée illisible -> deny', () => {
  assert.equal(run(S, null, { raw: 'x' }).decision, 'deny');
});
