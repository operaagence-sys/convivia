import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { run, write, edit, multiEdit, tmpDir } from './helpers.mjs';
import { stubProject } from './tooling-stubs.mjs';
import { readChangedFiles } from '../lib/common.mjs';

const S = 'format-and-check.mjs';
const post = (input) => ({ ...input, hook_event_name: 'PostToolUse', tool_response: { success: true } });
let n = 0;
const sid = () => `fmt-${process.pid}-${Date.now()}-${n++}`;

test('formate avec Prettier, lint avec ESLint et mémorise le fichier modifié', () => {
  const p = stubProject();
  const f = p.put('src/a.ts', 'export const a = 1;\n');
  const session_id = sid();
  const r2 = run(S, post({ ...write(f, 'x'), session_id }), { project: p.dir });
  assert.equal(r2.decision, 'none');
  assert.match(fs.readFileSync(f, 'utf8'), /formatted/);
  assert.deepEqual(readChangedFiles(session_id), ['src/a.ts']);
});

test('MultiEdit, Edit, extensions json/css/md pris en charge', () => {
  const p = stubProject();
  for (const rel of ['a.json', 'src/b.css', 'README.md', 'src/c.tsx', 'src/d.mjs']) {
    const f = p.put(rel, 'content\n');
    const input = rel.endsWith('.tsx') ? multiEdit(f, [{ old_string: 'a', new_string: 'b' }]) : edit(f, 'b');
    assert.equal(run(S, post(input), { project: p.dir }).decision, 'none', rel);
    assert.match(fs.readFileSync(f, 'utf8'), /formatted/, rel);
  }
});

test('ignore docs/*.md, node_modules, .next, .claude, lockfile, fichiers hors projet', () => {
  const p = stubProject();
  const skip = ['docs/01-prd.md', 'node_modules/x/index.js', '.next/server/a.js', '.claude/hooks/a.mjs', 'package-lock.json'];
  for (const rel of skip) {
    const f = p.put(rel, 'content\n');
    assert.equal(run(S, post(write(f, 'x')), { project: p.dir }).decision, 'none', rel);
    assert.equal(fs.readFileSync(f, 'utf8'), 'content\n', rel);
  }
  const outside = path.join(tmpDir('convivia-out-'), 'z.ts');
  fs.writeFileSync(outside, 'content\n');
  run(S, post(write(outside, 'x')), { project: p.dir });
  assert.equal(fs.readFileSync(outside, 'utf8'), 'content\n');
  const txt = p.put('notes.txt', 'content\n');
  run(S, post(write(txt, 'x')), { project: p.dir });
  assert.equal(fs.readFileSync(txt, 'utf8'), 'content\n');
});

test('erreurs ESLint restantes -> block avec 20 lignes au plus', () => {
  const p = stubProject();
  const f = p.put('src/bad.ts', 'LINTERROR\n');
  const r = run(S, post(write(f, 'x')), { project: p.dir });
  assert.equal(r.decision, 'block');
  assert.match(r.reason, /ESLint/);
  assert.ok(r.reason.split('\n').filter((l) => l.includes('error boom')).length <= 20);
  assert.ok(r.reason.includes('error boom'));
});

test('ESLint sans configuration -> silencieux ; Prettier en échec -> simple information', () => {
  const p = stubProject();
  const f = p.put('src/nc.ts', 'NOCONFIG\n');
  assert.equal(run(S, post(write(f, 'x')), { project: p.dir }).decision, 'none');
  const g = p.put('src/pf.ts', 'PRETTIERFAIL\n');
  const r = run(S, post(write(g, 'x')), { project: p.dir });
  assert.equal(r.code, 0);
  assert.equal(r.decision, 'message');
});

test('sans package.json ni outils : sortie silencieuse, fichier mémorisé', () => {
  const dir = tmpDir('convivia-bare-');
  const f = path.join(dir, 'src', 'a.ts');
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, 'x\n');
  const session_id = sid();
  const r = run(S, null, { project: dir, raw: JSON.stringify({ cwd: dir, session_id, ...post(write(f, 'x')) }) });
  assert.equal(r.code, 0);
  assert.equal(r.stdout.trim(), '');
  assert.equal(fs.readFileSync(f, 'utf8'), 'x\n');
  assert.deepEqual(readChangedFiles(session_id), ['src/a.ts']);
  // package.json but no Prettier / ESLint
  fs.writeFileSync(path.join(dir, 'package.json'), '{}');
  assert.equal(run(S, post(write(f, 'x')), { project: dir }).stdout.trim(), '');
});

test('état de session : écritures concurrentes sans perte', async () => {
  const p = stubProject();
  const session_id = sid();
  const files = Array.from({ length: 8 }, (_, i) => p.put(`src/f${i}.ts`, 'x\n'));
  const { spawn } = await import('node:child_process');
  const { HOOKS_DIR } = await import('./helpers.mjs');
  await Promise.all(files.map((f) => new Promise((resolve) => {
    const c = spawn(process.execPath, [path.join(HOOKS_DIR, S)], { env: { ...process.env, CLAUDE_PROJECT_DIR: p.dir }, stdio: ['pipe', 'ignore', 'ignore'] });
    c.on('close', resolve);
    c.stdin.end(JSON.stringify({ cwd: p.dir, session_id, ...post(write(f, 'x')) }));
  })));
  assert.equal(readChangedFiles(session_id).length, 8);
});

test('échec ouvert : entrée illisible -> exit 0 + systemMessage', () => {
  const r = run(S, null, { raw: '%%%' });
  assert.equal(r.code, 0);
  assert.equal(r.decision, 'message');
  assert.match(r.reason, /hook en erreur/);
});
