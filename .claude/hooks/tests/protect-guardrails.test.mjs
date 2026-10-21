import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { run, bash, write, edit, multiEdit, emptyProject } from './helpers.mjs';

const S = 'protect-guardrails.mjs';
const d = (input) => run(S, input).decision;
const proj = emptyProject();

test('Edit/Write/MultiEdit sur la configuration des hooks -> ask', () => {
  const files = [
    path.join(proj, '.claude', 'settings.json'),
    path.join(proj, '.claude', 'hooks', 'protect-secrets.mjs'), path.join(proj, '.claude', 'hooks', 'tests', 'a.test.mjs'),
    path.join(proj, '.claude', 'hooks', 'lib', 'common.mjs'), path.join(proj, '.CLAUDE', 'Settings.JSON'),
  ];
  for (const f of files) {
    assert.equal(d(write(f, 'x')), 'ask', f);
    assert.equal(d(edit(f, 'x')), 'ask', f);
    assert.equal(d(multiEdit(f, [{ old_string: 'a', new_string: 'b' }])), 'ask', f);
  }
});

test('interrupteur des hooks -> deny (E3)', () => {
  assert.equal(d(write(path.join(proj, 'notes.md'), '{"disableAllHooks": true}')), 'deny');
  assert.equal(d(bash('echo {"disableAllHooks":true} > foo.json')), 'deny');
  for (const f of [path.join(proj, '.claude', 'settings.local.json'), path.join(proj, '.Claude', 'Settings.Local.JSON'), path.join(os.homedir(), '.claude', 'settings.json')]) {
    assert.equal(d(write(f, '{}')), 'deny', f);
    assert.equal(d(edit(f, 'x')), 'deny', f);
  }
  for (const c of ['echo ok && rm .claude/settings.local.json', 'echo {} > .claude/settings.local.json', 'NODE_OPTIONS=--require=./x.js claude', 'export BASH_ENV=./x.sh', 'node -e "require(\'fs\').writeFileSync(\'.claude/settings.json\',\'{}\')"']) {
    assert.equal(d(bash(c)), 'deny', c);
  }
});

test('Bash modifiant les hooks -> ask', () => {
  const asks = [
    'echo x > .claude/settings.json', 'echo x >> .claude/hooks/a.mjs', 'rm .claude/hooks/a.mjs', 'rm -rf .claude/hooks', 'rm -rf .claude',
    'mv .claude/settings.json /tmp/x', 'cp /tmp/x .claude/settings.json', 'sed -i s/a/b/ .claude/hooks/a.mjs', 'tee .claude/settings.json < x',
    'Set-Content .claude/settings.json "{}"', 'Remove-Item -Recurse .claude\\hooks',
    'python -c "open(\'.claude/hooks/a.mjs\',\'w\')"',
    'git checkout -- .claude/settings.json', 'bash -c "rm .claude/hooks/x"', 'touch .claude/hooks/new.mjs', 'echo x > ./.claude/hooks/a.mjs',
  ];
  for (const c of asks) assert.equal(d(bash(c)), 'ask', c);
});

test('lectures et usages normaux -> rien', () => {
  const ok = [
    'cat .claude/settings.json', 'ls .claude/hooks', 'grep -r foo .claude/hooks', 'node --test .claude/hooks/tests', 'node .claude/hooks/protect-secrets.mjs',
    'git add .claude/hooks', 'git status', 'sed -n 1,5p .claude/hooks/a.mjs', 'echo hi > out.txt', 'git diff .claude/settings.json', 'rm -rf node_modules',
    'cat .claude/agents/pilot.md', 'head .claude/settings.json',
  ];
  for (const c of ok) assert.equal(d(bash(c)), 'none', c);
  assert.equal(d(write(path.join(proj, '.claude', 'agents', 'x.md'), 'x')), 'none');
  assert.equal(d(write(path.join(proj, 'src', 'a.ts'), 'x')), 'none');
  assert.equal(d({ tool_name: 'Read', tool_input: { file_path: path.join(proj, '.claude', 'settings.json') } }), 'none');
});

test('échec fermé', () => {
  assert.equal(run(S, null, { raw: '[]' }).decision, 'deny');
});
