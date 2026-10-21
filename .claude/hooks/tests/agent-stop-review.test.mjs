import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { run, emptyProject } from './helpers.mjs';
import { stubProject, transcript } from './tooling-stubs.mjs';

const S = 'agent-stop-review.mjs';
const proj = emptyProject();
const P = (...a) => path.join(proj, ...a);
const stop = (agent_type, calls, extra = {}, project) => run(S, {
  hook_event_name: 'SubagentStop', agent_type, agent_id: 'a1', agent_transcript_path: transcript(calls), stop_hook_active: false, ...extra,
}, project ? { project } : undefined);
const w = (file) => ['Write', { file_path: file, content: 'x' }];

test('agents en lecture seule : toute écriture est signalée', () => {
  for (const a of ['product-manager', 'security-reviewer']) {
    const r = stop(a, [w(P('src', 'a.ts'))]);
    assert.equal(r.decision, 'block', a);
    assert.match(r.reason, /lecture seule/);
    assert.equal(stop(a, [['Read', { file_path: P('src', 'a.ts') }], ['Bash', { command: 'git status' }]]).decision, 'none', a);
  }
});

test('conventions-keeper : uniquement docs/09-conventions.md', () => {
  assert.equal(stop('conventions-keeper', [w(P('docs', '09-conventions.md'))]).decision, 'none');
  assert.equal(stop('conventions-keeper', [w(`${proj}\\docs\\09-conventions.md`)]).decision, 'none');
  assert.equal(stop('conventions-keeper', [w(P('docs', '01-prd.md'))]).decision, 'block');
  assert.equal(stop('conventions-keeper', [w(P('src', 'a.ts'))]).decision, 'block');
});

test('qa-tester : uniquement des fichiers de test', () => {
  const ok = [P('tests', 'a.ts'), P('src', 'a.test.ts'), P('src', 'b.spec.tsx'), P('e2e', 'x.ts'), P('supabase', 'tests', 'a.sql'), P('docs', 'test-checklist-1.md')];
  for (const f of ok) assert.equal(stop('qa-tester', [w(f)]).decision, 'none', f);
  for (const f of [P('src', 'a.ts'), P('docs', '09-conventions.md'), P('supabase', 'migrations', '20260101000000_x.sql')]) {
    assert.equal(stop('qa-tester', [w(f)]).decision, 'block', f);
  }
});

test('.claude/** et .env* réservés : seul devops-engineer peut toucher .claude', () => {
  for (const a of ['frontend-developer', 'supabase-developer', 'ux-writer', 'qa-tester']) {
    const r = stop(a, [w(P('.claude', 'settings.json'))]);
    assert.equal(r.decision, 'block', a);
  }
  assert.equal(stop('devops-engineer', [w(P('.claude', 'hooks', 'x.mjs'))]).decision, 'none');
  assert.equal(stop('frontend-developer', [w(P('.env.example'))]).decision, 'block');
  assert.equal(stop('devops-engineer', [w(P('.env.example'))]).decision, 'none');
});

test('ui-designer, ux-writer, template-designer : pas de supabase/**', () => {
  for (const a of ['ui-designer', 'ux-writer', 'template-designer']) {
    assert.equal(stop(a, [w(P('supabase', 'migrations', '20260101000000_x.sql'))]).decision, 'block', a);
    assert.equal(stop(a, [w(P('src', 'x.tsx'))]).decision, 'none', a);
  }
  assert.equal(stop('supabase-developer', [w(P('supabase', 'migrations', '20260101000000_x.sql'))]).decision, 'none');
});

test('écritures par commande Bash signalées', () => {
  const cmds = [
    'echo hi > src/a.ts', 'echo hi >> notes.txt', 'cat x | tee out.txt', 'sed -i s/a/b/ src/a.ts', 'python -c "open(\'a.txt\',\'w\').write(\'x\')"',
    'node -e "require(\'fs\').writeFileSync(\'a.txt\',\'x\')"', 'Set-Content a.txt hi', '"x" | Out-File a.txt', 'cp a.txt b.txt', 'echo x > .claude/settings.json',
  ];
  for (const c of cmds) {
    const r = stop('frontend-developer', [['Bash', { command: c }]]);
    assert.equal(r.decision, 'block', c);
    assert.match(r.reason, /Bash/);
  }
  const ok = ['git status', 'npm test 2>&1', 'ls > /dev/null', 'echo hi 2>/dev/null', 'node script.js', 'cat a.txt | grep x', 'echo x > ' + path.join(os.tmpdir(), 'x.txt').replace(/\\/g, '/')];
  for (const c of ok) assert.equal(stop('frontend-developer', [['Bash', { command: c }]]).decision, 'none', c);
  const sp = path.join(os.homedir(), 'scratch-dir-test').replace(/\\/g, '/');
  assert.equal(stop('frontend-developer', [['Bash', { command: `echo x > ${sp}/out.txt` }]], { scratchpad_dir: sp }).decision, 'none');
  assert.equal(stop('frontend-developer', [['Bash', { command: `echo x > ${sp}/out.txt` }]]).decision, 'block');
  // a Bash write into a forbidden area is reported with the role rule too
  const r = stop('ux-writer', [['Bash', { command: 'echo x > supabase/a.sql' }]]);
  assert.match(r.reason, /supabase/);
});

test('anti-boucle : stop_hook_active -> message seulement', () => {
  const r = stop('security-reviewer', [w(P('src', 'a.ts'))], { stop_hook_active: true });
  assert.equal(r.code, 0);
  assert.equal(r.decision, 'message');
  assert.match(r.reason, /lecture seule/);
});

test('agent_type vide, inconnu ou transcript absent : rien', () => {
  assert.equal(stop('', [w(P('src', 'a.ts'))]).decision, 'none');
  assert.equal(stop('some-internal-agent', [w(P('src', 'a.ts'))]).decision, 'none');
  assert.equal(run(S, { agent_type: 'security-reviewer', agent_transcript_path: P('nope.jsonl') }).decision, 'none');
  assert.equal(run(S, { agent_type: 'security-reviewer' }).decision, 'none');
});

test('agents de construction : ESLint et tsc limités à leurs fichiers', () => {
  const p = stubProject();
  p.put('src/a.ts', 'LINTERROR\n');
  p.put('src/clean.ts', 'ok\n');
  p.put('TSC_FAIL', '1');
  const r = stop('frontend-developer', [w(path.join(p.dir, 'src', 'a.ts'))], {}, p.dir);
  assert.equal(r.decision, 'block');
  assert.match(r.reason, /ESLint/);
  assert.match(r.reason, /tsc --noEmit/);
  assert.match(r.reason, /src\/a\.ts\(1,1\)/);
  assert.ok(!r.reason.includes('not mine'));
  // clean file: no lint error; tsc error not in its files
  const r2 = stop('frontend-developer', [w(path.join(p.dir, 'src', 'clean.ts'))], {}, p.dir);
  assert.equal(r2.decision, 'none');
  // non-build agents are not linted
  assert.equal(stop('ux-writer', [w(path.join(p.dir, 'src', 'a.ts'))], {}, p.dir).decision, 'none');
});

test('échec ouvert', () => {
  const r = run(S, null, { raw: 'bad' });
  assert.equal(r.code, 0);
  assert.equal(r.decision, 'message');
});
