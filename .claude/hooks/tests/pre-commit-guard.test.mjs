import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { run, bash, tmpDir, fake } from './helpers.mjs';
import { scanDiff, parseAudit } from '../lib/gitscan.mjs';

const S = 'pre-commit-guard.mjs';
const hasGit = spawnSync('git', ['--version']).status === 0;
const opts = { skip: !hasGit && 'git absent' };

function sh(cwd, ...args) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
  assert.equal(r.status, 0, `git ${args.join(' ')} : ${r.stderr}`);
  return r.stdout;
}
function repo() {
  const dir = tmpDir('convivia-git-');
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
function commitAll(dir, msg = 'init') {
  sh(dir, 'add', '-A');
  sh(dir, 'commit', '-q', '-m', msg);
}
const hook = (dir, command) => run(S, bash(command), { project: dir });

test('dépôt propre : commit et push autorisés', opts, () => {
  const dir = repo();
  assert.equal(hook(dir, 'git commit -m "x"').decision, 'none');
  put(dir, 'src/a.ts', 'export const a = 1;\n');
  commitAll(dir);
  put(dir, 'src/b.ts', 'export const b = 2;\n');
  sh(dir, 'add', 'src/b.ts');
  assert.equal(hook(dir, 'git commit -m "feat: b"').decision, 'none');
  assert.equal(hook(dir, 'git push origin main').decision, 'none');
  assert.equal(hook(dir, 'echo hi && git status').decision, 'none');
  assert.equal(hook(dir, 'npm run build').decision, 'none');
});

test('hors dépôt git : rien', opts, () => {
  const dir = tmpDir('convivia-nogit-');
  assert.equal(hook(dir, 'git commit -am "x"').decision, 'none');
  assert.equal(hook(dir, 'git push').decision, 'none');
});

test('secret indexé -> deny avec fichier:ligne, sans recopier le secret', opts, () => {
  const dir = repo();
  const secret = fake.fedapayLive();
  put(dir, 'src/pay.ts', `const a = 1;\nconst key = "${secret}";\n`);
  sh(dir, 'add', '-A');
  const r = hook(dir, 'git commit -m "oops"');
  assert.equal(r.decision, 'deny');
  assert.match(r.reason, /src\/pay\.ts:2/);
  assert.ok(!r.stdout.includes(secret));
  assert.equal(hook(dir, 'echo ok; git commit -m "oops"').decision, 'deny');
  assert.equal(hook(dir, `git -C "${dir}" commit -m x`).decision, 'deny');
});

test('fichiers .env*, .pem, .key refusés ; .env.example autorisé', opts, () => {
  for (const f of ['.env', '.env.local', 'supabase/.env', 'certs/a.pem', 'certs/b.key']) {
    const dir = repo();
    put(dir, f, 'NOTHING=\n');
    sh(dir, 'add', '-f', f);
    const r = hook(dir, 'git commit -m x');
    assert.equal(r.decision, 'deny', f);
    assert.ok(r.reason.includes(f), f);
  }
  const dir = repo();
  put(dir, '.env.example', 'A=\nB=\n');
  sh(dir, 'add', '-A');
  assert.equal(hook(dir, 'git commit -m x').decision, 'none');
});

test('git commit -a : inclut les modifications non indexées', opts, () => {
  const dir = repo();
  put(dir, 'src/a.ts', 'export const a = 1;\n');
  commitAll(dir);
  put(dir, 'src/a.ts', `export const a = "${fake.meta()}";\n`);
  assert.equal(hook(dir, 'git commit -m "x"').decision, 'none'); // not staged, not part of this commit
  assert.equal(hook(dir, 'git commit -am "x"').decision, 'deny');
  assert.equal(hook(dir, 'git commit -a -m "x"').decision, 'deny');
  assert.equal(hook(dir, 'git commit --all -m "x"').decision, 'deny');
  assert.equal(hook(dir, 'git commit src/a.ts -m "x"').decision, 'deny');
});

test('git add … && git commit : fichiers non suivis inclus', opts, () => {
  const dir = repo();
  put(dir, 'src/a.ts', 'export const a = 1;\n');
  commitAll(dir);
  put(dir, 'src/new.ts', `const t = "${fake.sbSecret()}";\n`);
  assert.equal(hook(dir, 'git add -A && git commit -m x').decision, 'deny');
  assert.equal(hook(dir, 'git commit -m x').decision, 'none');
  fs.unlinkSync(path.join(dir, 'src/new.ts'));
  assert.equal(hook(dir, 'git add -A && git commit -m x').decision, 'none');
});

test('git push sans amont : tout l\'historique local est analysé', opts, () => {
  const dir = repo();
  put(dir, 'src/a.ts', `const k = "${fake.resend()}";\n`);
  commitAll(dir, 'first');
  fs.writeFileSync(path.join(dir, 'src/a.ts'), 'const k = process.env.RESEND_API_KEY;\n');
  commitAll(dir, 'fix');
  const r = hook(dir, 'git push -u origin main');
  assert.equal(r.decision, 'deny');
  assert.match(r.reason, /src\/a\.ts:1/);
});

test('git push avec amont : seuls les commits non poussés sont analysés', opts, () => {
  const dir = repo();
  const remote = tmpDir('convivia-remote-');
  sh(remote, 'init', '-q', '--bare', '-b', 'main');
  put(dir, 'src/a.ts', 'export const a = 1;\n');
  commitAll(dir);
  sh(dir, 'remote', 'add', 'origin', remote);
  sh(dir, 'push', '-q', '-u', 'origin', 'main');
  assert.equal(hook(dir, 'git push').decision, 'none');
  put(dir, 'src/b.ts', `const k = "${fake.fedapaySandbox()}";\n`);
  commitAll(dir, 'second');
  assert.equal(hook(dir, 'git push').decision, 'deny');
  assert.equal(hook(dir, 'git push origin main').decision, 'deny');
});

test('scanDiff : numéros de ligne, fichiers supprimés ignorés', () => {
  const secret = fake.webhook();
  const diff = [
    'commit:abcdef1234567890',
    '',
    'diff --git a/.env b/.env',
    'deleted file mode 100644',
    '--- a/.env',
    '+++ /dev/null',
    '@@ -1 +0,0 @@',
    '-A=1',
    'diff --git a/src/x.ts b/src/x.ts',
    '--- a/src/x.ts',
    '+++ b/src/x.ts',
    '@@ -1,0 +5,2 @@',
    '+ok',
    `+const s = "${secret}";`,
  ].join('\n');
  const r = scanDiff(diff);
  assert.deepEqual(r.files, []);
  assert.equal(r.secrets.length, 1);
  assert.equal(r.secrets[0].file, 'src/x.ts');
  assert.equal(r.secrets[0].line, 6);
  assert.equal(r.secrets[0].commit, 'abcdef12');
  assert.ok(!JSON.stringify(r).includes(secret));
});

test('parseAudit', () => {
  assert.equal(parseAudit('{"vulnerabilities":{},"metadata":{"vulnerabilities":{"high":0,"critical":0}}}').status, 'ok');
  const v = parseAudit(JSON.stringify({ vulnerabilities: { lodash: { severity: 'critical', via: [{ title: 'Prototype Pollution' }] }, left: { severity: 'low', via: [] } } }));
  assert.equal(v.status, 'vulns');
  assert.deepEqual(v.list.map((x) => x.name), ['lodash']);
  assert.equal(parseAudit('{"error":{"code":"ENOTFOUND","summary":"getaddrinfo"}}').status, 'unavailable');
  assert.equal(parseAudit('not json').status, 'unavailable');
  assert.equal(parseAudit('{"metadata":{"vulnerabilities":{"high":2,"critical":0}}}').status, 'vulns');
});

test('échec fermé', () => {
  assert.equal(run(S, null, { raw: 'x' }).decision, 'deny');
});
