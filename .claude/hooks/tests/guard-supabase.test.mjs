import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { run, bash, tmpDir, emptyProject, HOOKS_DIR } from './helpers.mjs';

// guard-supabase.mjs starts its hook loop on import (it waits for stdin): its exported helpers are
// called in a child process whose stdin is closed, one process for a whole list of inputs.
function viaModule(fn, inputs) {
  const url = pathToFileURL(path.join(HOOKS_DIR, 'guard-supabase.mjs')).href;
  const code = `const m = await import(${JSON.stringify(url)}); const xs = JSON.parse(process.env.GS_INPUTS); process.stderr.write('@@' + JSON.stringify(xs.map((x) => m[process.env.GS_FN](x))) + '@@');`;
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', code], {
    input: '', encoding: 'utf8', timeout: 60000,
    env: { ...process.env, GS_FN: fn, GS_INPUTS: JSON.stringify(inputs), CLAUDE_PROJECT_DIR: emptyProject() },
  });
  const m = /@@([\s\S]*)@@/.exec(r.stderr);
  assert.ok(m, r.stderr);
  return JSON.parse(m[1]);
}
const sqlRisksOf = (qs) => viaModule('sqlRisks', qs);
const stripOf = (qs) => viaModule('stripSqlComments', qs);

const S = 'guard-supabase.mjs';
// Neutral environment: a DATABASE_URL set on the developer machine must not change the results.
const CLEAN = { DATABASE_URL: '', SUPABASE_DB_URL: '' };
const d = (input, env = {}) => run(S, input, { env: { ...CLEAN, ...env } }).decision;
const mcp = (name, tool_input = {}, server = 'supabase') => ({ tool_name: `mcp__${server}__${name}`, tool_input });

test('opérations sur une base distante -> deny', () => {
  const denies = [
    'supabase db push', 'supabase.exe db push', 'supabase db push --dry-run',
    'supabase migration repair --status applied 123', 'supabase db diff --linked',
    'supabase gen types typescript --project-id x --db-url postgres://u@h/db', 'supabase link --project-ref abcdef',
    'supabase projects delete abc', 'supabase branches delete foo', 'supabase functions delete x', 'supabase secrets set A=b',
    'echo ok; supabase db push', 'bash -c "supabase db push"',
    // remote targets are refused, even for the local workflow commands
    'supabase db reset --linked', 'SUPABASE DB RESET --LINKED', 'npx supabase db reset --linked', 'supabase db reset --db-url postgres://u:p@db.example.com:5432/postgres',
    'supabase db reset --project-ref abcdef', 'cd . && supabase db reset --linked', 'bash -c "supabase db reset --linked"',
    'supabase test db --linked', 'supabase start --project-ref x', 'supabase migration list',
    'psql -h db.abcdefghijklmnop.supabase.co -c "select 1"', 'curl https://abcdefghijklmnop.supabase.co/rest/v1/guests',
  ];
  for (const c of denies) assert.equal(d(bash(c)), 'deny', c);
});

test('commandes locales destructives -> ask', () => {
  for (const c of ['supabase migration squash', 'supabase stop --no-backup']) assert.equal(d(bash(c)), 'ask', c);
});

test('workflow local : db reset / test db / start / stop sans confirmation', () => {
  const ok = [
    'supabase db reset', 'SUPABASE DB RESET', 'npx supabase db reset', 'supabase.exe db reset', 'cd . && supabase db reset', 'bash -c "supabase db reset"',
    'supabase db reset --local', 'supabase db reset && supabase test db', 'supabase test db', 'supabase start', 'supabase stop', 'supabase stop --backup',
    'supabase migration list --local', 'supabase db lint',
  ];
  for (const c of ok) assert.equal(d(bash(c)), 'none', c);
});

test('variable SUPABASE_DB_URL / DATABASE_URL : locale = rien, distante = deny', () => {
  const remote = 'postgres://postgres:secret@db.abcdef.supabase.co:5432/postgres';
  assert.equal(d(bash('supabase db reset'), { DATABASE_URL: remote }), 'deny');
  assert.equal(d(bash('supabase test db'), { SUPABASE_DB_URL: remote }), 'deny');
  assert.equal(d(bash('supabase start'), { DATABASE_URL: remote }), 'deny');
  assert.equal(d(bash(`DATABASE_URL=${remote} supabase db reset`)), 'deny');
  assert.equal(d(bash(`export SUPABASE_DB_URL="${remote}" && supabase db reset`)), 'deny');
  assert.equal(d(bash('DATABASE_URL=$PROD_URL supabase db reset')), 'deny');
  assert.equal(d(bash('supabase db reset'), { DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres' }), 'none');
  assert.equal(d(bash('supabase db reset'), { SUPABASE_DB_URL: 'postgresql://postgres:postgres@localhost:54322/postgres' }), 'none');
  assert.equal(d(bash('DATABASE_URL=postgresql://postgres:postgres@[::1]:54322/postgres supabase test db')), 'none');
  assert.equal(d(bash('DATABASE_URL=postgresql://postgres:postgres@localhost.evil.com:54322/postgres supabase db reset')), 'deny');
  assert.equal(d(bash('DATABASE_URL=postgresql://localhost@evil.com:5432/postgres supabase db reset')), 'deny');
  // a remote variable does not make unrelated commands suspicious
  assert.equal(d(bash('supabase status'), { DATABASE_URL: remote }), 'none');
});

test('continuation de ligne \\ + retour à la ligne', () => {
  assert.equal(d(bash('supabase db \\\n  push')), 'deny');
  assert.equal(d(bash('supabase db reset \\\n  --linked')), 'deny');
  assert.equal(d(bash('supabase db reset \\\r\n  --linked')), 'deny');
  assert.equal(d(bash('supabase db reset \\\n  --local')), 'none');
  assert.equal(d(bash('psql -c "DROP \\\nTABLE users"')), 'ask');
  assert.equal(d(bash('psql \\\n  -c "TRUNCATE guests"')), 'ask');
  assert.equal(d(bash('supabase \\\n db \\\n reset')), 'none');
});

test('SQL destructif en ligne de commande -> ask', () => {
  const asks = [
    'psql -c "DROP TABLE users"', 'psql -c "drop schema private cascade"', 'psql "$DB" -c "TRUNCATE guests"', 'psql -c "DELETE FROM guests"',
    'psql -c "ALTER TABLE guests DROP COLUMN phone"', 'psql -c "alter table t disable row level security"', 'pg_dump --clean mydb',
    'pg_dump -c mydb', 'echo "DROP VIEW v;" | psql', "psql <<EOF\nDROP POLICY p ON t;\nEOF", 'psql -c "DROP FUNCTION f()"', 'psql -c "DROP TYPE t"',
    'psql -c "DROP DATABASE x"', 'psql -c "DROP INDEX idx_guests_event"', 'psql -c "drop index if exists idx_x"', 'psql -c "DROP INDEX CONCURRENTLY i"',
    'psql -c "DELETE FROM guests WHERE true"', 'psql -c "delete from guests where 1=1"', 'psql -c "DELETE FROM guests WHERE 1 = 1;"',
    'psql -c "delete from guests where (true)"', 'psql -c "DELETE FROM guests WHERE TRUE RETURNING id"', 'psql -c "SELECT 1; DELETE FROM guests WHERE true"',
  ];
  for (const c of asks) assert.equal(d(bash(c)), 'ask', c);
});

test('commandes sûres -> rien', () => {
  const ok = [
    'supabase status', 'supabase migration new add_guests', 'supabase db lint',
    'supabase gen types typescript --local', 'psql -c "DELETE FROM guests WHERE id = 1"', 'psql -c "select * from guests"',
    'pg_dump mydb', 'psql -c "DELETE FROM t WHERE id=1; SELECT 1"', 'npm test', 'git commit -m "drop table docs"',
    'psql -c "DELETE FROM guests WHERE true AND id = 3"',
    'supabase help',
  ];
  for (const c of ok) assert.equal(d(bash(c)), 'none', c);
});

const PID = 'rvlfxpafjrnmhfxsgayd';
const READ = ['list_tables', 'list_extensions', 'list_migrations', 'get_advisors', 'get_project_url', 'list_edge_functions', 'get_edge_function', 'generate_typescript_types'];
const SERVERS = ['supabase', 'claude_ai_Supabase'];

test('MCP Supabase : lecture autorisée sur le bon projet, deux noms de serveur', () => {
  for (const srv of SERVERS) {
    for (const n of READ) assert.equal(d(mcp(n, { project_id: PID }, srv)), 'none', `${srv} ${n}`);
    assert.equal(d(mcp('get_project', { id: PID }, srv)), 'none', `${srv} get_project`);
    assert.equal(d(mcp('search_docs', {}, srv)), 'none');
  }
});

test('MCP Supabase : même outil refusé sur un autre projet, sans projet, projet mal formé', () => {
  const bad = ['abcdefghijklmnopqrst', '', ` ${PID}`, `${PID} `, PID.toUpperCase(), PID.replace('r', 'R'), `${PID}\n`, `${PID}x`, PID.slice(1), null, 42, [PID], { a: PID }];
  for (const srv of SERVERS) {
    for (const n of READ) {
      assert.equal(d(mcp(n, {}, srv)), 'deny', `${srv} ${n} sans project_id`);
      assert.equal(d({ tool_name: `mcp__${srv}__${n}` }), 'deny', `${srv} ${n} sans tool_input`);
      for (const v of bad) assert.equal(d(mcp(n, { project_id: v }, srv)), 'deny', `${srv} ${n} ${JSON.stringify(v)}`);
      // the id placed in another field does not count
      assert.equal(d(mcp(n, { id: PID, projectId: PID }, srv)), 'deny', `${srv} ${n} autre champ`);
    }
    assert.equal(d(mcp('get_project', {}, srv)), 'deny');
    assert.equal(d(mcp('get_project', { id: 'autre' }, srv)), 'deny');
    assert.equal(d(mcp('get_project', { id: PID, project_id: 'autre' }, srv)), 'deny');
    assert.equal(d(mcp('get_project', { id: PID.toUpperCase() }, srv)), 'deny');
  }
  // tool name with altered case is not in the allowlist
  assert.equal(d(mcp('List_Tables', { project_id: PID })), 'deny');
});

test('MCP Supabase : écriture, SQL, journaux, gestion et outils inconnus refusés même sur le bon projet', () => {
  const denied = [
    'get_logs', 'deploy_edge_function', 'create_project', 'create_branch', 'delete_branch', 'merge_branch',
    'reset_branch', 'rebase_branch', 'pause_project', 'restore_project', 'list_branches', 'list_projects', 'list_organizations', 'get_organization',
    'get_cost', 'confirm_cost', 'get_publishable_keys', 'get_anon_key', 'get_service_role_key', 'create_secret', 'some_new_write_tool', '',
  ];
  for (const srv of SERVERS) {
    for (const n of denied) assert.equal(d(mcp(n, { project_id: PID, id: PID, query: 'select 1' }, srv)), 'deny', `${srv} ${n}`);
  }
  assert.equal(d({ tool_name: 'mcp__github__create_issue', tool_input: {} }), 'none');
});

test('échec fermé', () => {
  assert.equal(run(S, null, { raw: '{' }).decision, 'deny');
});

/* execute_sql / apply_migration sur le staging ----------------------------------------- */

const OTHER = 'abcdefghijklmnopqrst';
const SQL = 'create table public.events (id uuid primary key);\n';
/** Project dir with the given migration files. */
function projectWith(files) {
  const proj = tmpDir('convivia-mig-');
  const dir = path.join(proj, 'supabase', 'migrations');
  fs.mkdirSync(dir, { recursive: true });
  for (const [n, c] of Object.entries(files)) fs.writeFileSync(path.join(dir, n), c);
  return proj;
}
const dp = (input, project) => run(S, input, { project, env: CLEAN }).decision;
const rp = (input, project) => run(S, input, { project, env: CLEAN }).reason;

test('execute_sql : autorisé sur le staging (deux noms de serveur), SQL ordinaire', () => {
  for (const srv of SERVERS) {
    assert.equal(d(mcp('execute_sql', { project_id: PID, query: 'select 1' }, srv)), 'none');
    assert.equal(d(mcp('execute_sql', { project_id: PID, query: 'select * from public.events' }, srv)), 'none');
    assert.equal(d(mcp('execute_sql', { project_id: PID, query: 'delete from public.guests where id = 1' }, srv)), 'none');
  }
});

test('execute_sql : refusé sur un autre projet, sans projet, identifiant mal formé', () => {
  const bad = [OTHER, '', ` ${PID}`, `${PID} `, PID.toUpperCase(), `${PID}\n`, `${PID}x`, null, 42, [PID], { a: PID }];
  const proj = projectWith({ '20260101000000_init.sql': SQL });
  bad.forEach((v, i) => {
    const srv = SERVERS[i % 2];
    assert.equal(dp(mcp('execute_sql', { project_id: v, query: 'select 1' }, srv), proj), 'deny', `execute_sql ${JSON.stringify(v)}`);
  });
  for (const srv of SERVERS) {
    assert.equal(d(mcp('execute_sql', { query: 'select 1' }, srv)), 'deny');
    assert.equal(d(mcp('execute_sql', { id: PID, projectId: PID, query: 'select 1' }, srv)), 'deny');
    assert.equal(d({ tool_name: `mcp__${srv}__execute_sql` }), 'deny');
    // destructive SQL on another project: deny (not ask)
    assert.equal(d(mcp('execute_sql', { project_id: OTHER, query: 'drop table x' }, srv)), 'deny');
  }
  assert.equal(d(mcp('Execute_SQL', { project_id: PID, query: 'select 1' })), 'deny');
  assert.equal(d(mcp('execute_sql', { project_id: PID })), 'deny', 'query absente');
  assert.equal(d(mcp('execute_sql', { project_id: PID, query: '  ' })), 'deny', 'query vide');
  assert.equal(d(mcp('execute_sql', { project_id: PID, query: 42 })), 'deny', 'query non texte');
});

test('apply_migration : toujours refusé (le porteur du projet applique les migrations), message vers le porteur', () => {
  const proj = projectWith({ '20260101000000_add_events.sql': SQL });
  const inputs = [
    { project_id: PID, name: 'add_events', query: SQL }, // fichier et SQL correspondants : refusé quand même
    { project_id: PID, name: 'add_events' }, { project_id: OTHER, name: 'x', query: SQL }, { name: 'x', query: SQL }, {},
  ];
  for (const srv of SERVERS) {
    for (const ti of inputs) {
      assert.equal(dp(mcp('apply_migration', ti, srv), proj), 'deny', JSON.stringify(ti));
      assert.match(rp(mcp('apply_migration', ti, srv), proj), /appliquées au staging par le porteur du projet avec `supabase db push`/);
      assert.match(rp(mcp('apply_migration', ti, srv), proj), /Écris le fichier dans supabase\/migrations\/ et signale-le dans ton rapport/);
    }
    assert.equal(d({ tool_name: `mcp__${srv}__apply_migration` }), 'deny');
  }
});

test('CLI Supabase distante : refus avec renvoi vers le porteur du projet', () => {
  for (const c of ['supabase db push', 'supabase db push --dry-run', 'supabase link --project-ref x']) {
    const r = run(S, bash(c), { env: CLEAN });
    assert.equal(r.decision, 'deny', c);
    assert.match(r.reason, /seul le porteur du projet la lance, dans son propre terminal/, c);
    assert.doesNotMatch(r.reason, /apply_migration/, c);
  }
});

test('execute_sql : SQL destructif / sensible -> ask (deux serveurs)', () => {
  const asks = [
    'DROP SCHEMA public CASCADE', 'drop schema if exists x', 'DROP DATABASE postgres', 'drop table public.guests', 'DROP TABLE IF EXISTS a, b',
    'drop function public.f()', 'drop policy p on public.t', 'drop owned by x', 'drop publication p',
    'TRUNCATE public.guests', 'truncate table public.guests restart identity cascade',
    'DELETE FROM public.guests', 'delete from public.guests;', 'delete from public.guests where true', 'delete from public.guests where 1=1',
    'select 1; delete from public.guests',
    'ALTER TABLE public.guests DISABLE ROW LEVEL SECURITY', 'alter table public.guests   disable   row   level   security',
    'ALTER TABLE public.guests DROP COLUMN phone',
    // schémas gérés par la plateforme
    'insert into auth.users (id) values (gen_random_uuid())', 'update auth.users set email = null', 'delete from auth.users where id = 1', 'TRUNCATE auth.users',
    "insert into storage.buckets (id, name) values ('a', 'a')", "update storage.objects set name = 'x' where id = 1", "delete from storage.objects where bucket_id = 'a'",
    'insert into "storage"."buckets" (id) values (1)', 'update supabase_migrations.schema_migrations set name = null where id = 1',
    'delete from supabase_functions.hooks where id = 1', "insert into vault.secrets (secret) values ('x')", "select vault.create_secret('x')",
    'select * from vault.decrypted_secrets', 'update cron.job set active = false where jobid = 1', 'delete from cron.job where jobid = 1',
    'select cron.alter_job(1)', "select cron.schedule_in_database('a', '* * * * *', 'select 1', 'postgres')",
    'alter table auth.users add column x int', 'drop trigger t on auth.users', 'grant select on auth.users to anon', 'revoke all on storage.objects from anon',
    'alter function storage.foo() owner to postgres', "comment on table auth.users is 'x'",
    'create trigger t after insert on auth.users for each row execute function public.f()', 'create policy p on storage.objects for select using (true)',
    'create index i on auth.users (email)', 'create table auth.x (id int)', "create function storage.f() returns int language sql as 'select 1'",
    'create schema supabase_x', 'create schema if not exists auth',
    'WITH d AS (DELETE FROM auth.users RETURNING id) SELECT * FROM d',
    // rôles et droits
    'ALTER ROLE authenticator SET statement_timeout = 0', "alter user postgres with password 'x'", 'create role r', 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon',
    'GRANT ALL ON ALL TABLES IN SCHEMA public TO anon', 'grant select on all tables in schema public to authenticated', 'GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO public',
    'grant all on all sequences in schema public to anon, authenticated',
    'CREATE EXTENSION pgcrypto', 'create extension if not exists "uuid-ossp" with schema extensions',
    // divers
    'ALTER SYSTEM SET work_mem = 1', 'set role postgres', 'set local role service_role', 'set session authorization postgres',
    'DO $$ BEGIN drop table x; END $$', 'do $$ begin perform 1; end $$', 'do language plpgsql $f$ begin null; end $f$',
    "execute 'select 1'", "create function f() returns void language plpgsql as $$ begin execute format('drop table %I', 'x'); end $$",
    "copy public.guests to program 'cat'", "copy public.t from '/etc/passwd'", "select pg_read_file('/etc/passwd')", "select * from dblink('x', 'select 1') as t(a int)",
    // contournements par commentaires / chaînes
    "select '--'; drop table x", "select '/*'; drop table x; select '*/'", '/* a /* nested */ still comment */ drop table x',
    'drop/**/table x', 'DROP\n\tTABLE x', "select e'it\\'s'; drop table x", 'select $$ -- $$; drop table x', "select $t$ /* $t$; truncate y; select '*/'",
  ];
  const proj = projectWith({});
  asks.forEach((q, i) => {
    const srv = SERVERS[i % 2]; // both server names are exercised, one process per query
    assert.equal(dp(mcp('execute_sql', { project_id: PID, query: q }, srv), proj), 'ask', `${srv} ${q}`);
  });
  sqlRisksOf(asks).forEach((r, i) => assert.ok(r.length > 0, asks[i]));
});

test('execute_sql : SQL ordinaire de migration -> aucune question', () => {
  const ok = [
    'select 1', 'create table public.events (id uuid primary key, owner uuid references auth.users(id) on delete cascade)',
    'create table public.p (id uuid references auth.users on delete cascade)', 'alter table public.events enable row level security',
    'alter table public.events force row level security', 'alter table public.events add column title text',
    'alter table public.events add constraint fk foreign key (owner) references auth.users (id)',
    'create policy "own" on public.events for select using (owner = auth.uid())', 'create function public.f() returns int language sql as $$ select auth.uid()::int $$',
    "select cron.schedule('job', '0 * * * *', $$select 1$$)", "select cron.unschedule('job')", 'select * from cron.job',
    'select * from auth.users', 'insert into public.events (id) values (gen_random_uuid())', "update public.events set title = 'x' where id = 1",
    'delete from public.events where id = 1', 'delete from public.events where id = 1 and true',
    'grant execute on function public.f() to authenticated', 'revoke all on function public.f() from public', 'grant usage on schema public to anon',
    'grant select on public.events to authenticated', 'create trigger t after insert on public.events for each row execute function public.f()',
    'create index i on public.events (owner)', '-- drop table x\nselect 1', '/* truncate t */ select 2', "select 'a;b'", 'create unique index u on public.events (title)',
    'alter table public.events add column auth_id uuid', 'create table public.authors (id int)', 'select auth.uid()', 'insert into public.storage_files (id) values (1)',
    'create view public.v as select * from public.events', 'create table public.t (updated_at timestamptz default now())',
  ];
  sqlRisksOf(ok).forEach((r, i) => assert.deepEqual(r, [], ok[i]));
  // end to end on a few (one process per call is slow)
  for (const q of ok.slice(0, 6)) assert.equal(d(mcp('execute_sql', { project_id: PID, query: q })), 'none', q);
});

test('stripSqlComments : retire les commentaires, garde le texte entre guillemets', () => {
  const [a, b, c, e] = stripOf(['select 1 -- c\nselect 2', "select '--x'", 'select /* a /* b */ c */ 1', 'select $$ -- x $$']);
  assert.equal(a.replace(/\s+/g, ' '), 'select 1 select 2');
  assert.equal(b, "select '--x'");
  assert.equal(c.replace(/\s+/g, ' '), 'select 1');
  assert.equal(e, 'select $$ -- x $$');
});

test('toujours refusés sur le staging : get_logs, deploy_edge_function, gestion de projets, outils inconnus', () => {
  const proj = projectWith({});
  for (const srv of SERVERS) {
    for (const n of ['get_logs', 'deploy_edge_function', 'create_project', 'create_branch', 'list_branches', 'list_projects', 'get_cost', 'get_publishable_keys', 'some_new_tool']) {
      assert.equal(dp(mcp(n, { project_id: PID, name: 'x', query: 'select 1' }, srv), proj), 'deny', `${srv} ${n}`);
    }
  }
});

test('TRUNCATE : formes protectrices sans question, vraie instruction toujours confirmée', () => {
  const calm = [
    'create trigger t_reject before truncate on public.pricing_tiers for each statement execute function private.reject_modification();',
    'CREATE OR REPLACE TRIGGER t before update or delete or truncate on public.x for each statement execute function private.f();',
    'revoke insert, update, delete, truncate, references, trigger, maintain on table public.pricing_tiers from anon;',
    'revoke truncate on public.x from authenticated;',
    'revoke all on table public.x from anon, authenticated;',
    'revoke delete on public.x from anon;',
    "comment on table public.audit_log is 'ajout seul (UPDATE / DELETE / TRUNCATE refusés)';",
  ];
  for (const r of sqlRisksOf(calm)) assert.deepEqual(r, []);
  const loud = [
    'truncate public.pricing_tiers', 'TRUNCATE TABLE public.x', 'select 1; truncate x',
    'revoke all on public.x from anon; truncate public.x',
    'revoke truncate public.x from anon',
    'create function f() returns void language sql as $$ truncate public.x $$',
  ];
  for (const r of sqlRisksOf(loud)) assert.ok(r.includes('TRUNCATE'), JSON.stringify(r));
});

test('les migrations de protection du dépôt ne déclenchent aucun risque', () => {
  const root = path.resolve(HOOKS_DIR, '..', '..');
  const files = ['20261021140300_pricing_tiers.sql', '20261021140200_audit_log_and_analytics_events.sql']
    .map((f) => path.join(root, 'supabase', 'migrations', f))
    .filter((f) => fs.existsSync(f));
  if (!files.length) return;
  const res = sqlRisksOf(files.map((f) => fs.readFileSync(f, 'utf8')));
  res.forEach((r, i) => assert.deepEqual(r, [], path.basename(files[i])));
});
