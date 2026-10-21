import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { run, tmpDir } from './helpers.mjs';

const S = 'rls-check.mjs';

function check(sql, name = '20260415093000_test.sql') {
  const p = tmpDir('convivia-rls-');
  const dir = path.join(p, 'supabase', 'migrations');
  fs.mkdirSync(dir, { recursive: true });
  const f = path.join(dir, name);
  fs.writeFileSync(f, sql);
  return run(S, { tool_name: 'Write', tool_input: { file_path: f, content: sql } }, { project: p });
}

const GOOD_TABLE = 'create table public.guests (id uuid primary key);\nalter table public.guests enable row level security;\n';

test('migration propre -> rien', () => {
  const sql = `${GOOD_TABLE}
create function private.is_owner(e uuid) returns boolean language sql security definer set search_path = '' as $$ select true $$;
create view public.v_stats with (security_invoker = true) as select 1;
create policy "owner" on public.guests for select using (owner_id = auth.uid());
grant usage on schema public to anon;
grant select on public.guests to authenticated;
create table private.audit (id int);
`;
  const r = check(sql);
  assert.equal(r.decision, 'none', r.reason);
  assert.equal(r.code, 0);
});

test('table sans RLS -> block', () => {
  assert.equal(check('create table public.guests (id int);').decision, 'block');
  assert.equal(check('create table guests (id int);').decision, 'block');
  assert.equal(check('CREATE TABLE IF NOT EXISTS "guests" (id int);').decision, 'block');
  assert.equal(check('create table guests (id int);\nalter table other enable row level security;').decision, 'block');
  assert.equal(check('create table guests (id int);\nalter table guests enable row level security;').decision, 'none');
  assert.equal(check('-- create table fake (id int);\nselect 1;').decision, 'none');
});

test('security definer sans search_path -> block', () => {
  const bad = "create function f() returns int language plpgsql security definer as $$ begin return 1; end; $$;";
  assert.equal(check(bad).decision, 'block');
  assert.equal(check("create or replace function f() returns int as $body$ select 1 $body$ language sql SECURITY DEFINER;").decision, 'block');
  assert.equal(check("create function f() returns int security definer as $$ select 1 $$ language sql set search_path = public;").decision, 'none');
  assert.equal(check("create function f() returns int as $$ select 1 $$ language sql;").decision, 'none');
  // security definer mentioned only inside the body is not a declaration
  assert.equal(check("create function f() returns int as $$ select 'security definer' $$ language sql;").decision, 'none');
  // two functions: only the second is bad
  const two = "create function a() returns int as $$ select 1; $$ language sql;\ncreate function b() returns int as $$ select 2; $$ language sql security definer;";
  const r = check(two);
  assert.equal(r.decision, 'block');
  assert.match(r.reason, /ligne 2/);
});

test('grants dangereux -> block', () => {
  assert.equal(check('grant select on public.guests to anon;').decision, 'block');
  assert.equal(check('GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;').decision, 'block');
  assert.equal(check('grant all on public.guests to service_role;').decision, 'block');
  assert.equal(check('alter default privileges in schema public grant select on tables to anon;').decision, 'block');
  assert.equal(check('grant usage on schema public to anon;').decision, 'none');
  assert.equal(check('grant select on public.guests to authenticated;').decision, 'none');
});

test('vues sans security_invoker -> block', () => {
  assert.equal(check('create view public.v as select 1;').decision, 'block');
  assert.equal(check('create or replace view v as select 1;').decision, 'block');
  assert.equal(check('create view v with (security_invoker = on) as select 1;').decision, 'none');
  assert.equal(check('create view v as select 1;\nalter view v set (security_invoker = true);').decision, 'none');
  assert.equal(check('create view private.v as select 1;').decision, 'none');
  assert.equal(check('create materialized view public.mv as select 1;').decision, 'none');
});

test('politiques permissives et RLS désactivée -> block', () => {
  assert.equal(check('create policy p on public.t for select using (true);').decision, 'block');
  assert.equal(check('create policy p on public.t for insert with check (true);').decision, 'block');
  assert.equal(check('create policy p on public.t for select using ( TRUE );').decision, 'block');
  assert.equal(check('-- rls-check: justified catalogue public en lecture seule\ncreate policy p on public.t for select using (true);').decision, 'none');
  assert.equal(check('alter table public.t disable row level security;').decision, 'block');
});

test('fichiers hors migrations et fichiers absents ignorés', () => {
  const p = tmpDir('convivia-rls2-');
  const f = path.join(p, 'supabase', 'seed.sql');
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, 'create table t (id int);');
  assert.equal(run(S, { tool_name: 'Write', tool_input: { file_path: f } }, { project: p }).decision, 'none');
  const missing = path.join(p, 'supabase', 'migrations', '20260101000000_x.sql');
  assert.equal(run(S, { tool_name: 'Write', tool_input: { file_path: missing } }, { project: p }).decision, 'none');
});

test('échec fermé : block avec raison', () => {
  const r = run(S, null, { raw: 'oops' });
  assert.equal(r.decision, 'block');
  assert.match(r.reason, /hook en erreur/);
});

test('grant select anon : accepté seulement avec le marqueur anon-read justifié', () => {
  const ok = (sql) => check(sql).decision === 'none';
  assert.ok(ok('-- rls-check: anon-read paliers de prix publics\ngrant select on table public.pricing_tiers to anon;'));
  assert.ok(ok('-- rls-check: anon-read paliers publics\ngrant select on public.pricing_tiers to anon, authenticated;'));
  assert.ok(ok('grant select on public.pricing_tiers to anon; -- rls-check: anon-read paliers publics'));
  // sans marqueur / marqueur vide : comportement inchangé
  assert.equal(check('grant select on public.pricing_tiers to anon;').decision, 'block');
  assert.equal(check('-- rls-check: anon-read\ngrant select on public.pricing_tiers to anon;').decision, 'block');
  assert.equal(check('-- rls-check: anon-read ok\n\ngrant select on public.pricing_tiers to anon;').decision, 'block');
  // jamais autre chose que SELECT, jamais tout un schéma
  for (const g of [
    'grant insert on public.pricing_tiers to anon;',
    'grant update on public.pricing_tiers to anon;',
    'grant delete on public.pricing_tiers to anon;',
    'grant all on public.pricing_tiers to anon;',
    'grant select, insert on public.pricing_tiers to anon;',
    'grant select on all tables in schema public to anon;',
    'grant select on public.a, public.b to anon;',
    'grant select (id) on public.pricing_tiers to anon;',
    'grant select on public.pricing_tiers to anon with grant option;',
    'grant select on public.pricing_tiers to anon, public;',
    'grant select on private.secrets to anon;',
  ]) {
    assert.equal(check(`-- rls-check: anon-read raison\n${g}`).decision, 'block', g);
  }
});
