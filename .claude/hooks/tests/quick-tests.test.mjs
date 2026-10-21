import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { run, write, tmpDir } from './helpers.mjs';
import { stubProject, transcript } from './tooling-stubs.mjs';
import { readChangedFiles } from '../lib/common.mjs';

const S = 'quick-tests.mjs';
let n = 0;
const sid = () => `qt-${process.pid}-${Date.now()}-${n++}`;
const fmt = (p, session_id, rel) => run('format-and-check.mjs', { hook_event_name: 'PostToolUse', session_id, ...write(path.join(p.dir, rel), 'x') }, { project: p.dir });
const stopEvt = (p, session_id, extra = {}) => run(S, { hook_event_name: 'Stop', session_id, stop_hook_active: false, ...extra }, { project: p.dir });

test('Stop sans fichier modifié ou sans package.json : rien', () => {
  const p = stubProject();
  assert.equal(stopEvt(p, sid()).decision, 'none');
  const bare = tmpDir('convivia-qt-bare-');
  assert.equal(run(S, { hook_event_name: 'Stop', session_id: sid() }, { project: bare }).decision, 'none');
});

test('repli : tsc + ESLint + vitest related ; échec -> block ; succès -> état vidé', () => {
  const p = stubProject();
  const s = sid();
  p.put('src/a.ts', 'ok\n');
  fmt(p, s, 'src/a.ts');
  assert.deepEqual(readChangedFiles(s), ['src/a.ts']);

  p.put('TSC_FAIL', '1');
  let r = stopEvt(p, s);
  assert.equal(r.decision, 'block');
  assert.match(r.reason, /tsc --noEmit/);
  assert.deepEqual(readChangedFiles(s), ['src/a.ts'], 'état conservé en cas d\'échec');
  // anti-loop
  r = stopEvt(p, s, { stop_hook_active: true });
  assert.equal(r.decision, 'message');
  fs.unlinkSync(path.join(p.dir, 'TSC_FAIL'));

  p.put('VITEST_FAIL', '1');
  r = stopEvt(p, s);
  assert.equal(r.decision, 'block');
  assert.match(r.reason, /vitest related/);
  fs.unlinkSync(path.join(p.dir, 'VITEST_FAIL'));

  p.put('src/a.ts', 'LINTERROR\n');
  r = stopEvt(p, s);
  assert.equal(r.decision, 'block');
  assert.match(r.reason, /ESLint/);
  p.put('src/a.ts', 'ok\n');

  r = stopEvt(p, s);
  assert.equal(r.decision, 'none');
  assert.deepEqual(readChangedFiles(s), []);
  assert.equal(stopEvt(p, s).decision, 'none');
});

test('script test:quick prioritaire', () => {
  const p = stubProject({ packageJson: { name: 'x', scripts: { 'test:quick': 'node quick.cjs' } } });
  const s = sid();
  p.put('src/a.ts', 'ok\n');
  p.put('quick.cjs', 'console.log("QUICK FAILED HERE"); process.exit(1)');
  p.put('TSC_FAIL', '1'); // would fail the fallback, must not be used
  fmt(p, s, 'src/a.ts');
  let r = stopEvt(p, s);
  assert.equal(r.decision, 'block');
  assert.match(r.reason, /QUICK FAILED HERE/);
  assert.doesNotMatch(r.reason, /tsc --noEmit/);
  p.put('quick.cjs', 'process.exit(0)');
  r = stopEvt(p, s);
  assert.equal(r.decision, 'none');
});

test('SubagentStop : seulement les agents de construction, fichiers du transcript', () => {
  const p = stubProject();
  p.put('src/a.ts', 'ok\n');
  p.put('TSC_FAIL', '1');
  const calls = [['Write', { file_path: path.join(p.dir, 'src', 'a.ts'), content: 'x' }]];
  const sub = (agent_type, extra = {}) => run(S, {
    hook_event_name: 'SubagentStop', agent_type, agent_id: 'a', agent_transcript_path: transcript(calls), stop_hook_active: false, ...extra,
  }, { project: p.dir });
  assert.equal(sub('frontend-developer').decision, 'block');
  assert.equal(sub('devops-engineer').decision, 'block');
  assert.equal(sub('frontend-developer', { stop_hook_active: true }).decision, 'message');
  for (const a of ['ux-writer', 'qa-tester', 'security-reviewer', 'conventions-keeper', 'product-manager', '', 'internal']) {
    assert.equal(sub(a).decision, 'none', a);
  }
  // transcript without code files
  const only = run(S, {
    hook_event_name: 'SubagentStop', agent_type: 'frontend-developer', agent_transcript_path: transcript([['Write', { file_path: path.join(p.dir, 'README.md'), content: 'x' }]]),
  }, { project: p.dir });
  assert.equal(only.decision, 'none');
});

test('échec ouvert', () => {
  const r = run(S, null, { raw: '' });
  assert.equal(r.code, 0);
  assert.equal(r.decision, 'message');
});
