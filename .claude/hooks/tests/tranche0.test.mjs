// Tranche 0 additions: admin definer views (rls-check), new secret file kinds
// (protect-secrets), git stash / globs / cd tracking (protect-guardrails),
// compound commands (pre-commit-guard), Windows paths and case, hook 3 edge cases.
// Fake secrets are built at runtime (helpers.fake).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { run, bash, write, edit, read, tmpDir, emptyProject, fake } from './helpers.mjs';

const proj = emptyProject();
const isWin = process.platform === 'win32';

/* ------------------------------------------------------------------ */
/* rls-check : vues admin voulues par docs/07 § 14                      */
/* ------------------------------------------------------------------ */

function rls(sql, { name = '20260415093000_test.sql', sub = '' } = {}) {
  const p = tmpDir('convivia-rls-t0-');
  const dir = path.join(p, 'supabase', 'migrations', sub);
  fs.mkdirSync(dir, { recursive: true });
  const f = path.join(dir, name);
  fs.writeFileSync(f, sql);
  return run('rls-check.mjs', { tool_name: 'Write', tool_input: { file_path: f, content: sql } }, { project: p });
}

const MARK = '-- rls-check: definer-view vue admin voulue par 07 § 14, filtrée par rôle';
const ADMIN_VIEW = (name = 'admin_events_v', guard = "private.has_any_admin_role(array['super_admin','support']::public.admin_role[])") =>
  `create view public.${name} with (security_barrier = true) as\nselect e.id, e.status from public.events e\nwhere ${guard};`;

test('rls-check : vue admin valide (marqueur + nom + fonction de contrôle) acceptée', () => {
  for (const guard of [
    "private.has_any_admin_role(array['super_admin','support']::public.admin_role[])",
    "private.has_admin_role('super_admin')",
    "private.has_permission('finance.read')",
    "has_admin_role('finance') and e.status <> 'draft'",
  ]) {
    const r = rls(`${MARK}\n${ADMIN_VIEW('admin_events_v', guard)}`);
    assert.equal(r.decision, 'none', `${guard} : ${r.reason}`);
  }
  assert.equal(rls(`${MARK}\ncreate or replace view public.admin_funnel_v with (security_invoker = false) as select 1 from t where private.has_admin_role('marketing');`).decision, 'none');
  // marqueur deux lignes au-dessus ; plusieurs vues
  assert.equal(rls(`${MARK}\n\n${ADMIN_VIEW('admin_usage_v')}`).decision, 'none');
  assert.equal(rls(`${MARK}\n${ADMIN_VIEW('admin_usage_v')}\n\n${MARK}\n${ADMIN_VIEW('admin_growth_v')}`).decision, 'none');
  // vue organisateur filtrée par auth.uid()
  assert.equal(rls(`${MARK}\ncreate view public.organizer_refunds_v as select r.amount from public.refunds r join public.payments p on p.id = r.payment_id where p.organizer_id = auth.uid();`).decision, 'none');
});

test('rls-check : vue admin sans fonction de contrôle, sans marqueur ou mal nommée -> block', () => {
  const noGuard = rls(`${MARK}\ncreate view public.admin_events_v as select e.id from public.events e;`);
  assert.equal(noGuard.decision, 'block');
  assert.match(noGuard.reason, /has_admin_role/);
  assert.equal(rls(`${MARK}\ncreate view public.admin_events_v as select e.id from public.events e where e.id is not null;`).decision, 'block');
  // fonction citée seulement dans un commentaire ou dans la liste de colonnes (pas dans WHERE)
  assert.equal(rls(`${MARK}\ncreate view public.admin_events_v as select e.id -- private.has_admin_role('x')\nfrom public.events e;`).decision, 'block');
  assert.equal(rls(`${MARK}\ncreate view public.admin_events_v as select private.has_admin_role('x') as ok from public.events e;`).decision, 'block');
  // sans marqueur
  const noMark = rls(ADMIN_VIEW());
  assert.equal(noMark.decision, 'block');
  assert.match(noMark.reason, /definer-view/);
  // marqueur sans raison, ou trop loin
  assert.equal(rls(`-- rls-check: definer-view\n${ADMIN_VIEW()}`).decision, 'block');
  assert.equal(rls(`${MARK}\n\n\n\n${ADMIN_VIEW()}`).decision, 'block');
  // marqueur du mauvais type
  assert.equal(rls(`-- rls-check: justified catalogue\n${ADMIN_VIEW()}`).decision, 'block');
  // nom hors motif admin_*_v
  for (const n of ['events_summary', 'admin_events', 'admin__v', 'adminx_events_v', 'my_admin_events_v', 'organizer_payments_v']) {
    assert.equal(rls(`${MARK}\n${ADMIN_VIEW(n)}`).decision, 'block', n);
  }
  // organizer_refunds_v filtrée par une fonction admin au lieu de auth.uid()
  assert.equal(rls(`${MARK}\ncreate view public.organizer_refunds_v as select 1 from t where private.has_admin_role('x');`).decision, 'block');
  assert.equal(rls(`${MARK}\ncreate view public.organizer_refunds_v as select 1 from t;`).decision, 'block');
});

test('rls-check : security_invoker = false et autres cas de vues', () => {
  assert.equal(rls('create view public.v with (security_invoker = false) as select 1;').decision, 'block');
  assert.equal(rls('create view public.v with (security_invoker = off) as select 1;').decision, 'block');
  assert.equal(rls(`${MARK}\ncreate view public.v with (security_invoker = false) as select 1 where private.has_admin_role('x');`).decision, 'block');
  assert.equal(rls('create view public.v with (security_invoker = true) as select 1;').decision, 'none');
  assert.equal(rls('create view private.admin_events_v as select 1;').decision, 'none'); // schéma non public
});

test('rls-check : schéma non public, sous-dossier et GRANT … TO anon', () => {
  assert.equal(rls('create table private.audit (id int);\ncreate view private.v as select 1;\ncreate table extensions.t (id int);').decision, 'none');
  assert.equal(rls('create table public.t (id int);', { sub: 'archive' }).decision, 'none'); // sous-dossier : non appliqué par la CLI, ignoré
  assert.equal(rls('GRANT SELECT ON public.guests TO ANON;').decision, 'block');
  assert.equal(rls('Grant Select On public.guests To Anon;').decision, 'block');
  assert.equal(rls('GRANT SELECT\n  ON public.guests\n  TO\n  ANON;').decision, 'block');
  assert.equal(rls('grant select on public.guests\n  to authenticated,\n  anon;').decision, 'block');
  assert.equal(rls('GRANT ALL PRIVILEGES\nON ALL TABLES IN SCHEMA public\nTO authenticated;').decision, 'block');
  assert.equal(rls('GRANT USAGE ON SCHEMA public TO ANON;').decision, 'none');
  assert.equal(rls('GRANT SELECT ON public.guests TO AUTHENTICATED;').decision, 'none');
});

/* ------------------------------------------------------------------ */
/* protect-secrets : nouveaux fichiers sensibles                       */
/* ------------------------------------------------------------------ */

test('protect-secrets : .envrc, clés SSH, keystore, credentials.json, service-account*.json', () => {
  const S = 'protect-secrets.mjs';
  const d = (i) => run(S, i).decision;
  const files = [
    '.envrc', 'sub/.envrc', 'id_rsa', 'id_rsa.pub', 'id_ed25519', 'id_ed25519_work', '.ssh/id_rsa', '.ssh/id_ed25519', 'android/release.keystore',
    'credentials.json', 'config/credentials.json', 'service-account.json', 'service-account-prod.json', 'keys/service-account-firebase.json',
  ];
  for (const f of files) {
    const p = path.join(proj, ...f.split('/'));
    assert.equal(d(read(p)), 'deny', `Read ${f}`);
    assert.equal(d(write(p, 'x')), 'deny', `Write ${f}`);
    assert.equal(d(edit(p, 'x')), 'deny', `Edit ${f}`);
    assert.equal(d(bash(`cat ${f}`)), 'deny', `cat ${f}`);
    assert.equal(d(bash(`echo x > ${f}`)), 'deny', `> ${f}`);
  }
  assert.equal(d(read(`${proj}\\.SSH\\ID_RSA`)), 'deny');
  assert.equal(d(read(`${proj}\\.ENVRC`)), 'deny');
  assert.equal(d(read(`${proj}\\Service-Account-Prod.JSON`)), 'deny');
  for (const f of ['credentials.json.example', 'my-credentials.json', 'service-accounts.md', 'service-account.md', 'id_rsa_notes.txt'.replace('id_rsa_notes', 'ssh_notes'), 'envrc.md', 'src/credentials.ts']) {
    assert.equal(d(read(path.join(proj, f))), 'none', f);
  }
});

/* ------------------------------------------------------------------ */
/* protect-guardrails : stash, restore/checkout, globs, cd, Windows    */
/* ------------------------------------------------------------------ */

test('protect-guardrails : git stash, git checkout/restore .claude…, globs', () => {
  const S = 'protect-guardrails.mjs';
  const d = (c) => run(S, bash(c)).decision;
  const asks = [
    'git stash', 'git stash push', 'git stash -u', 'git stash pop', 'git stash apply', 'git stash drop', 'git stash clear', 'git stash save wip', 'git -C . stash',
    'echo hi && git stash', 'git add . && git stash && git pull', 'bash -c "git stash"',
    'git checkout -- .claude', 'git checkout -- .claude/', 'git checkout -- .claude/hooks', 'git checkout HEAD -- .claude/settings.json', 'git checkout stash@{0} -- .claude',
    'git restore .claude', 'git restore .claude/hooks', 'git restore .claude/hooks/*', 'git restore .claude/*', 'git restore --source=HEAD~1 .claude/hooks',
    'git restore -s HEAD .claude\\hooks', 'git restore --staged --worktree .claude/settings.json',
    'rm -rf .claude/*', 'rm .claude/hooks/*.mjs',
  ];
  for (const c of asks) assert.equal(d(c), 'ask', c);
  assert.equal(d('echo x; git restore .claude/settings.local.json'), 'deny');
  const ok = ['git stash list', 'git stash show', 'git stash show -p', 'git checkout -- src', 'git restore src/a.ts', 'git restore --staged .', 'rm -rf .claude/agents/x.md', 'git status'];
  for (const c of ok) assert.equal(d(c), 'none', c);
});

test('protect-guardrails : cd dans .claude puis écriture', () => {
  const d = (c) => run('protect-guardrails.mjs', bash(c)).decision;
  const asks = [
    'cd .claude && rm -rf hooks', 'cd .claude/hooks; rm a.mjs', 'cd .claude && echo x > settings.json', 'cd .claude/hooks && sed -i s/a/b/ lib/common.mjs',
    'cd .claude\\hooks && del a.mjs', 'cd .claude && mv hooks /tmp/x', 'cd .claude && cd hooks && touch new.mjs', 'cd src/.. && rm .claude/hooks/a.mjs',
  ];
  for (const c of asks) assert.equal(d(c), 'ask', c);
  const ok = ['cd .claude/agents && rm x.md', 'cd src && rm a.ts', 'cd .claude && ls hooks', 'cd .claude && cat settings.json', 'cd .claude/agents && cd .. && ls'];
  for (const c of ok) assert.equal(d(c), 'none', c);
});

test('protect-guardrails : chemins Windows (antislashs) et casse', () => {
  const d = (i) => run('protect-guardrails.mjs', i).decision;
  const files = [
    `${proj}\\.CLAUDE\\Hooks\\protect-secrets.mjs`, `${proj}\\.claude\\HOOKS\\lib\\common.mjs`, `${proj}\\.CLAUDE\\SETTINGS.JSON`,
    `${proj}/.CLAUDE/hooks/tests/a.test.mjs`, `${proj}\\.claude\\hooks\\..\\hooks\\a.mjs`,
  ];
  for (const f of files) {
    assert.equal(d(write(f, 'x')), 'ask', f);
    assert.equal(d(edit(f, 'x')), 'ask', f);
  }
  assert.equal(d(write(`${proj}\\.Claude\\Settings.Local.JSON`, '{}')), 'deny');
  const asks = [
    'rm .CLAUDE\\Hooks\\a.mjs', 'Remove-Item -Recurse .claude\\HOOKS', 'echo x > .CLAUDE\\Settings.JSON', 'del .claude\\hooks\\a.mjs', 'Set-Content .CLAUDE\\settings.json "{}"',
    'copy x.txt .CLAUDE\\HOOKS\\a.mjs', 'git checkout -- .CLAUDE\\hooks', 'echo ok && rd /s /q .claude\\Hooks',
  ];
  for (const c of asks) assert.equal(d(bash(c)), 'ask', c);
  assert.equal(d(write(`${proj}\\.CLAUDE\\Agents\\x.md`, 'x')), 'none');
  assert.equal(d(bash('type .CLAUDE\\Hooks\\a.mjs')), 'none');
});

/* ------------------------------------------------------------------ */
/* migration-immutable : chemins Windows, casse, sous-dossier           */
/* ------------------------------------------------------------------ */

function migProject(names) {
  const p = tmpDir('convivia-mig-t0-');
  const dir = path.join(p, 'supabase', 'migrations');
  fs.mkdirSync(dir, { recursive: true });
  for (const n of names) fs.writeFileSync(path.join(dir, n), '-- sql\n');
  return { p, dir };
}

test('migration-immutable : antislashs, casse et sous-dossier', () => {
  const { p, dir } = migProject(['20260101000000_init.sql', '20260301000000_payments.sql']);
  const d = (i) => run('migration-immutable.mjs', i, { project: p }).decision;
  assert.equal(d(write(`${p}\\supabase\\migrations\\20260101000000_init.sql`, 'x')), 'deny');
  assert.equal(d(edit(`${p}\\supabase\\migrations\\20260301000000_payments.sql`, 'x')), 'ask');
  assert.equal(d(write(`${p}\\supabase\\migrations\\bad name.sql`, 'x')), 'deny');
  assert.equal(d(write(`${p}\\supabase\\migrations\\ma_migration.sql`, 'x')), 'deny');
  if (isWin) {
    // le système de fichiers de Windows ignore la casse : le fichier existe bien
    assert.equal(d(write(`${p}\\SUPABASE\\MIGRATIONS\\20260101000000_init.sql`, 'x')), 'deny');
    assert.equal(d(write(`${p}\\Supabase\\Migrations\\20260301000000_PAYMENTS.sql`, 'x')), 'ask');
  }
  assert.equal(d(write(`${p}\\SUPABASE\\MIGRATIONS\\ma_migration.sql`, 'x')), 'deny');
  assert.equal(d(write(`${p}\\SUPABASE\\MIGRATIONS\\20260415093000_new_one.sql`, 'x')), 'none');
  // sous-dossier : la CLI Supabase ne l'applique pas, le hook l'ignore
  fs.mkdirSync(path.join(dir, 'archive'), { recursive: true });
  assert.equal(d(write(path.join(dir, 'archive', '20260101000000_init.sql'), 'x')), 'none');
  assert.equal(d(write(path.join(dir, 'archive', 'whatever.sql'), 'x')), 'none');
});

/* ------------------------------------------------------------------ */
/* guard-live-keys : cas limites                                       */
/* ------------------------------------------------------------------ */

test('guard-live-keys : espaces autour de =, point final, casse, double slash', () => {
  const d = (c) => run('guard-live-keys.mjs', bash(c)).decision;
  const denied = [
    'WHATSAPP_MODE = live npm run dev', 'WHATSAPP_MODE =live node a.js', 'WHATSAPP_MODE= live node a.js', 'export WHATSAPP_MODE = "live"', '$env:WHATSAPP_MODE="live"',
    'FEDAPAY_ENV = live npm start', 'VERCEL_ENV = production node a.js', 'whatsapp_mode  =  LIVE npm run dev',
    'curl https://api.fedapay.com./v1/transactions', 'curl https://api.fedapay.com/v1/transactions', 'curl API.FEDAPAY.COM/v1/x', 'curl https://api.fedapay.com.',
    'curl https://GRAPH.facebook.com/v21.0/123/messages', 'curl https://Graph.Facebook.Com/v21.0/123/MESSAGES -d {}',
    'curl https://graph.facebook.com//v21.0/123//messages', 'curl https://graph.facebook.com/v21.0//123/messages', 'curl https://graph.facebook.com///messages',
    'curl "https://graph.facebook.com/v21.0/123/messages?x=1"', "curl 'https://graph.facebook.com/v21.0/123/messages'",
  ];
  for (const c of denied) assert.equal(d(c), 'deny', c);
  const ok = [
    'curl https://sandbox-api.fedapay.com/v1/transactions', 'curl https://SANDBOX-API.FEDAPAY.COM./v1/x', 'WHATSAPP_MODE=simulate npm run dev', 'WHATSAPP_MODE = test npm run dev',
    'curl https://graph.facebook.com/v21.0/123/message_templates', 'curl https://graph.facebook.com//v21.0/123/phone_numbers',
    'grep "WHATSAPP_MODE == live" -r src',
  ];
  for (const c of ok) assert.equal(d(c), 'none', c);
});

/* ------------------------------------------------------------------ */
/* pre-commit-guard : commandes composées                              */
/* ------------------------------------------------------------------ */

const hasGit = spawnSync('git', ['--version']).status === 0;
const gopts = { skip: !hasGit && 'git absent' };

function sh(cwd, ...args) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
  assert.equal(r.status, 0, `git ${args.join(' ')} : ${r.stderr}`);
  return r.stdout;
}
function repo() {
  const dir = tmpDir('convivia-git-t0-');
  sh(dir, 'init', '-q', '-b', 'main');
  sh(dir, 'config', 'user.email', 't@example.com');
  sh(dir, 'config', 'user.name', 'Test');
  sh(dir, 'config', 'commit.gpgsign', 'false');
  sh(dir, 'config', 'core.autocrlf', 'false');
  return dir;
}
function put(dir, rel, content) {
  const f = path.join(dir, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, content);
}
const pc = (dir, command) => run('pre-commit-guard.mjs', bash(command), { project: dir });

test('pre-commit-guard : git add . && git commit (fichier non suivi avec secret)', gopts, () => {
  const dir = repo();
  put(dir, 'src/a.ts', 'export const a = 1;\n');
  sh(dir, 'add', '-A');
  sh(dir, 'commit', '-q', '-m', 'init');
  const secret = fake.fedapayLive();
  put(dir, 'src/leak.ts', `export const k = "${secret}";\n`);
  for (const c of ['git add . && git commit -m x', 'git add . ; git commit -m x', 'git add -A && git commit -m "x" && echo done', 'echo start && git add src && git commit -m x', 'git add . && git commit -am x']) {
    const r = pc(dir, c);
    assert.equal(r.decision, 'deny', c);
    assert.match(r.reason, /src\/leak\.ts:1/);
    assert.ok(!r.stdout.includes(secret));
  }
  assert.equal(pc(dir, 'git commit -m x').decision, 'none'); // rien d'indexé
  fs.unlinkSync(path.join(dir, 'src/leak.ts'));
  assert.equal(pc(dir, 'git add . && git commit -m x').decision, 'none');
});

test('pre-commit-guard : cd <dépôt> && git add . && git commit, depuis un autre dossier', gopts, () => {
  const dir = repo();
  put(dir, 'src/a.ts', `export const k = "${fake.meta()}";\n`);
  const elsewhere = tmpDir('convivia-elsewhere-');
  assert.equal(run('pre-commit-guard.mjs', bash(`cd "${dir}" && git add . && git commit -m x`), { project: elsewhere }).decision, 'deny');
  assert.equal(run('pre-commit-guard.mjs', bash(`cd "${dir}"; git add -A; git commit -m x`), { project: elsewhere }).decision, 'deny');
  assert.equal(run('pre-commit-guard.mjs', bash(`git -C "${dir}" add . && git -C "${dir}" commit -m x`), { project: elsewhere }).decision, 'deny');
  assert.equal(run('pre-commit-guard.mjs', bash('git add . && git commit -m x'), { project: elsewhere }).decision, 'none'); // autre dossier, hors dépôt
});

test('pre-commit-guard : cd x; git push -f et push composé', gopts, () => {
  const dir = repo();
  put(dir, 'sub/a.ts', `export const k = "${fake.resend()}";\n`);
  sh(dir, 'add', '-A');
  sh(dir, 'commit', '-q', '-m', 'leak');
  for (const c of ['cd sub; git push -f', 'cd sub && git push --force origin main', 'echo ok && git push -u origin main', 'git status; git push', 'git pull && git push -f origin main']) {
    assert.equal(pc(dir, c).decision, 'deny', c);
  }
  const clean = repo();
  put(clean, 'sub/a.ts', 'export const a = 1;\n');
  sh(clean, 'add', '-A');
  sh(clean, 'commit', '-q', '-m', 'ok');
  assert.equal(pc(clean, 'cd sub; git push -f').decision, 'none'); // ce hook ne juge que le contenu (la force est l\'affaire de irreversible-actions)
  assert.equal(run('irreversible-actions.mjs', bash('cd sub; git push -f'), { project: clean }).decision, 'deny');
});
