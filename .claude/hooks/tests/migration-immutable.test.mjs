import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { run, write, edit, multiEdit, tmpDir } from './helpers.mjs';

const S = 'migration-immutable.mjs';

function project(names) {
  const p = tmpDir('convivia-mig-');
  const dir = path.join(p, 'supabase', 'migrations');
  fs.mkdirSync(dir, { recursive: true });
  for (const n of names) fs.writeFileSync(path.join(dir, n), '-- sql\n');
  return { p, dir };
}

test('migration existante ancienne -> deny ; la plus récente -> ask', () => {
  const { p, dir } = project(['20260101000000_init.sql', '20260201000000_guests.sql', '20260301000000_payments.sql']);
  const d = (input) => run(S, input, { project: p }).decision;
  const old = path.join(dir, '20260101000000_init.sql');
  const mid = path.join(dir, '20260201000000_guests.sql');
  const latest = path.join(dir, '20260301000000_payments.sql');
  for (const f of [old, mid]) {
    assert.equal(d(write(f, 'x')), 'deny', f);
    assert.equal(d(edit(f, 'x')), 'deny', f);
    assert.equal(d(multiEdit(f, [{ old_string: 'a', new_string: 'b' }])), 'deny', f);
  }
  assert.match(run(S, edit(old, 'x'), { project: p }).reason, /nouvelle migration/);
  for (const f of [latest]) {
    assert.equal(d(write(f, 'x')), 'ask', f);
    assert.equal(d(edit(f, 'x')), 'ask', f);
  }
});

test('nouvelle migration : nom valide autorisé, nom invalide refusé', () => {
  const { p, dir } = project(['20260101000000_init.sql']);
  const d = (input) => run(S, input, { project: p }).decision;
  assert.equal(d(write(path.join(dir, '20260415093000_add_guest_tables.sql'), 'x')), 'none');
  const bad = ['add_guests.sql', '2026_add.sql', '20260415093000-add.sql', '20260415093000_Add.sql', '20260415093000_.sql', '20260415_add.sql', '20260415093000_add guests.sql', '20260415093000_add.SQL.sql'];
  for (const b of bad) assert.equal(d(write(path.join(dir, b), 'x')), 'deny', b);
});

test('chemins Windows et autres fichiers', () => {
  const { p, dir } = project(['20260101000000_init.sql']);
  const d = (input) => run(S, input, { project: p }).decision;
  assert.equal(d(write(`${p}\\supabase\\migrations\\20260101000000_init.sql`, 'x')), 'ask');
  assert.equal(d(write(path.join(p, 'supabase', 'seed.sql'), 'x')), 'none');
  assert.equal(d(write(path.join(p, 'supabase', 'tests', 'a.sql'), 'x')), 'none');
  assert.equal(d(write(path.join(dir, 'README.md'), 'x')), 'none');
  assert.equal(d({ tool_name: 'Read', tool_input: { file_path: path.join(dir, '20260101000000_init.sql') } }), 'none');
});

test('dossier migrations absent', () => {
  const p = tmpDir('convivia-mig-empty-');
  assert.equal(run(S, write(path.join(p, 'supabase', 'migrations', '20260415093000_first.sql'), 'x'), { project: p }).decision, 'none');
});

test('échec fermé', () => {
  assert.equal(run(S, null, { raw: '' }).decision, 'deny');
});
