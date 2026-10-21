// Hook 6: the DECISION (deny / ask / none) that comes out of `gitleaks` and of
// `npm audit`, with stub executables and no network.
//
// How the stubs work (no change to the hook is needed):
//  - the hook is run with a COPY of node placed in a temp "bin" directory, so
//    that `npmCliPath()` finds no real npm there and falls back to `npm` from
//    PATH, which is our stub (it prints bin/audit.json);
//  - `gitleaks` is another copy of node: `gitleaks version` really runs
//    `node version` in the hook's working directory (bin/version.js), and
//    `gitleaks protect|detect ...` runs `protect.js` / `detect.js`
//    from the repository root (written by each test). Exit code and output come
//    from the environment variable STUB_EXIT.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { tmpDir, HOOKS_DIR } from './helpers.mjs';

const hasGit = spawnSync('git', ['--version']).status === 0;
const WIN = process.platform === 'win32';
const EXT = WIN ? '.exe' : '';

function sh(cwd, ...args) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
  assert.equal(r.status, 0, `git ${args.join(' ')} : ${r.stderr}`);
  return r.stdout;
}
function put(dir, rel, content) {
  const f = path.join(dir, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, content);
}
function repo() {
  const dir = tmpDir('convivia-stubgit-');
  sh(dir, 'init', '-q', '-b', 'main');
  sh(dir, 'config', 'user.email', 't@example.com');
  sh(dir, 'config', 'user.name', 'Test');
  sh(dir, 'config', 'commit.gpgsign', 'false');
  sh(dir, 'config', 'core.autocrlf', 'false');
  return dir;
}

let bins;
/** bin/ with node copy, gitleaks copy, version.js, npm stub. Built once. */
function makeBins() {
  if (bins) return bins;
  const dir = tmpDir('convivia-stubbin-');
  const nodeCopy = path.join(dir, `node${EXT}`);
  fs.copyFileSync(process.execPath, nodeCopy);
  const gl = path.join(dir, `gitleaks${EXT}`);
  try {
    fs.linkSync(nodeCopy, gl);
  } catch {
    fs.copyFileSync(nodeCopy, gl);
  }
  if (!WIN) {
    fs.chmodSync(nodeCopy, 0o755);
    fs.chmodSync(gl, 0o755);
  }
  fs.writeFileSync(path.join(dir, 'version.js'), 'process.exit(0);\n');
  if (WIN) {
    fs.writeFileSync(path.join(dir, 'npm.cmd'), '@type "%~dp0audit.json"\r\n');
  } else {
    fs.writeFileSync(path.join(dir, 'npm'), '#!/bin/sh\ncat "$(dirname "$0")/audit.json"\n', { mode: 0o755 });
  }
  bins = { dir, nodeCopy, gl };
  return bins;
}

/** Run pre-commit-guard with the stubs. `withGitleaks` puts `gitleaks` on PATH. */
function guard(project, command, { audit, gitleaks } = {}) {
  const b = makeBins();
  if (audit !== undefined) fs.writeFileSync(path.join(b.dir, 'audit.json'), audit);
  const env = { ...process.env, CLAUDE_PROJECT_DIR: project };
  const pathKey = Object.keys(env).find((k) => k.toLowerCase() === 'path') || 'PATH';
  // The gitleaks stub is reachable only when asked: otherwise hide it in a sub-directory-free PATH.
  const dirs = [];
  if (gitleaks) {
    dirs.push(b.dir);
    env.STUB_EXIT = String(gitleaks.exit);
    env.STUB_TEXT = gitleaks.text || 'leak';
  } else {
    // npm stub only: a directory that holds npm but not gitleaks
    const only = path.join(b.dir, 'npm-only');
    if (!fs.existsSync(only)) {
      fs.mkdirSync(only, { recursive: true });
      fs.copyFileSync(path.join(b.dir, WIN ? 'npm.cmd' : 'npm'), path.join(only, WIN ? 'npm.cmd' : 'npm'));
      if (!WIN) fs.chmodSync(path.join(only, 'npm'), 0o755);
    }
    // audit.json is read next to the script: mirror it
    fs.writeFileSync(path.join(only, 'audit.json'), fs.readFileSync(path.join(b.dir, 'audit.json'), 'utf8'));
    dirs.push(only);
  }
  env[pathKey] = [...dirs, env[pathKey]].join(path.delimiter);
  const payload = JSON.stringify({ cwd: project, session_id: 'stub-session', tool_name: 'Bash', tool_input: { command } });
  const r = spawnSync(b.nodeCopy, [path.join(HOOKS_DIR, 'pre-commit-guard.mjs')], { input: payload, encoding: 'utf8', env, cwd: b.dir, timeout: 120000 });
  let json = null;
  try {
    json = r.stdout.trim() ? JSON.parse(r.stdout) : null;
  } catch {
    /* none */
  }
  const out = json && json.hookSpecificOutput;
  return { decision: out ? out.permissionDecision : 'none', reason: out ? out.permissionDecisionReason || '' : '', stderr: r.stderr, stdout: r.stdout };
}

const GL_SCRIPT = 'console.log(process.env.STUB_TEXT || "leak"); process.exit(Number(process.env.STUB_EXIT || 0));\n';
const opts = { skip: !hasGit && 'git absent' };

function stagedRepo({ lock = false } = {}) {
  const dir = repo();
  put(dir, 'src/a.ts', 'export const a = 1;\n');
  sh(dir, 'add', '-A');
  sh(dir, 'commit', '-q', '-m', 'init');
  put(dir, 'src/b.ts', 'export const b = 2;\n');
  if (lock) put(dir, 'package-lock.json', '{"lockfileVersion":3}\n');
  sh(dir, 'add', '-A');
  // stub scripts executed by the `gitleaks` copy, untracked and not staged
  put(dir, 'protect.js', GL_SCRIPT);
  put(dir, 'detect.js', GL_SCRIPT);
  return dir;
}

/* gitleaks -------------------------------------------------------------------- */

test('gitleaks : code 1 -> deny (sortie citée, rien de recopié) ; code 0 -> rien', opts, () => {
  const dir = stagedRepo();
  const hit = guard(dir, 'git commit -m x', { gitleaks: { exit: 1, text: 'finding: generic-api-key in src/b.ts' } });
  assert.equal(hit.decision, 'deny');
  assert.match(hit.reason, /gitleaks a détecté des secrets/);
  assert.match(hit.reason, /generic-api-key/);
  assert.equal(guard(dir, 'git commit -m x', { gitleaks: { exit: 0 } }).decision, 'none');
});

test('gitleaks : un code autre que 1 (erreur d\'outil) ne bloque pas ; hors d\'un commit, il n\'est pas lancé', opts, () => {
  const dir = stagedRepo();
  assert.equal(guard(dir, 'git commit -m x', { gitleaks: { exit: 2 } }).decision, 'none');
  assert.equal(guard(dir, 'git status', { gitleaks: { exit: 1 } }).decision, 'none');
});

test('gitleaks absent : le contrôle par motifs reste seul et laisse passer un commit propre', opts, () => {
  const dir = stagedRepo();
  assert.equal(guard(dir, 'git commit -m x', { audit: '{}' }).decision, 'none');
});

test('gitleaks sur git push (historique non poussé) : code 1 -> deny', opts, () => {
  const dir = stagedRepo();
  sh(dir, 'commit', '-q', '-m', 'second');
  assert.equal(guard(dir, 'git push origin main', { gitleaks: { exit: 1, text: 'finding in history' } }).decision, 'deny');
  assert.equal(guard(dir, 'git push origin main', { gitleaks: { exit: 0 } }).decision, 'none');
});

/* npm audit ------------------------------------------------------------------- */

const VULNS = JSON.stringify({ vulnerabilities: { lodash: { severity: 'critical', via: [{ title: 'Prototype Pollution' }] }, left: { severity: 'low', via: [] } } });
const CLEAN = JSON.stringify({ vulnerabilities: {}, metadata: { vulnerabilities: { high: 0, critical: 0 } } });
const OFFLINE = JSON.stringify({ error: { code: 'ENOTFOUND', summary: 'getaddrinfo ENOTFOUND registry.npmjs.org' } });

test('npm audit : vulnérabilité haute/critique -> deny (commit et push)', opts, () => {
  const dir = stagedRepo({ lock: true });
  const r = guard(dir, 'git commit -m x', { audit: VULNS });
  assert.equal(r.decision, 'deny');
  assert.match(r.reason, /npm audit/);
  assert.match(r.reason, /lodash \(critical\)/);
  assert.ok(!/left/.test(r.reason), 'une vulnérabilité faible n\'est pas citée');
  sh(dir, 'commit', '-q', '-m', 'second', '--no-verify');
  assert.equal(guard(dir, 'git push origin main', { audit: VULNS }).decision, 'deny');
});

test('npm audit : audit hors ligne ou illisible -> ask (jamais un refus ni un silence)', opts, () => {
  const dir = stagedRepo({ lock: true });
  for (const out of [OFFLINE, 'not json']) {
    const r = guard(dir, 'git commit -m x', { audit: out });
    assert.equal(r.decision, 'ask', out);
    assert.match(r.reason, /npm audit impossible/);
  }
});

test('npm audit : propre -> rien ; sans package-lock.json -> pas d\'audit', opts, () => {
  const withLock = stagedRepo({ lock: true });
  assert.equal(guard(withLock, 'git commit -m x', { audit: CLEAN }).decision, 'none');
  const noLock = stagedRepo();
  assert.equal(guard(noLock, 'git commit -m x', { audit: VULNS }).decision, 'none');
});

test('npm audit : un secret détecté reste un deny même si l\'audit est hors ligne', opts, () => {
  const dir = stagedRepo({ lock: true });
  put(dir, 'src/c.ts', `const k = "${'sk_' + 'live_' + 'x'.repeat(32)}";\n`);
  sh(dir, 'add', 'src/c.ts');
  const r = guard(dir, 'git commit -m x', { audit: OFFLINE });
  assert.equal(r.decision, 'deny');
  assert.match(r.reason, /src\/c\.ts:1/);
});
