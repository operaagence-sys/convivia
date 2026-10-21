// Shared helpers for the Convivia Claude Code hooks. No npm dependency.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

/** Secret environment variables (TRD section 15). NEXT_PUBLIC_* are public. */
export const SECRET_ENV_VARS = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'FEDAPAY_SECRET_KEY',
  'FEDAPAY_WEBHOOK_SECRET',
  'WHATSAPP_ACCESS_TOKEN',
  'WHATSAPP_APP_SECRET',
  'WHATSAPP_WEBHOOK_VERIFY_TOKEN',
  'QR_SIGNING_SECRET',
  'SCAN_SESSION_SECRET',
  'OPTOUT_HASH_SECRET',
  'SCAN_CODE_ENCRYPTION_KEY',
  'RESEND_API_KEY',
  'SENTRY_AUTH_TOKEN',
];

export const CODE_EXTS = ['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs'];

export const BUILD_AGENTS = [
  'supabase-developer',
  'whatsapp-specialist',
  'payments-specialist',
  'entry-control-specialist',
  'template-designer',
  'ui-designer',
  'frontend-developer',
  'admin-analytics-developer',
  'devops-engineer',
];

export const KNOWN_AGENTS = [
  ...BUILD_AGENTS,
  'product-manager',
  'security-reviewer',
  'conventions-keeper',
  'qa-tester',
  'ux-writer',
  'pilot',
];

/* ------------------------------------------------------------------ */
/* Output helpers                                                      */
/* ------------------------------------------------------------------ */

export const deny = (reason) => ({ type: 'deny', reason });
export const ask = (reason) => ({ type: 'ask', reason });
export const block = (reason, systemMessage) => ({ type: 'block', reason, systemMessage });
export const info = (message) => ({ type: 'message', reason: message });

function render(res, event, name) {
  if (!res) return null;
  const prefix = `[hook ${name}] `;
  if (res.type === 'deny' || res.type === 'ask') {
    if (event === 'PreToolUse') {
      return {
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: res.type,
          permissionDecisionReason: prefix + res.reason,
        },
      };
    }
    return { decision: 'block', reason: prefix + res.reason };
  }
  if (res.type === 'block') {
    const o = { decision: 'block', reason: prefix + res.reason };
    if (res.systemMessage) o.systemMessage = res.systemMessage;
    return o;
  }
  if (res.type === 'message') return { systemMessage: prefix + res.reason };
  return null;
}

async function readStdin() {
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  return Buffer.concat(chunks).toString('utf8');
}

function emit(obj) {
  if (obj) process.stdout.write(JSON.stringify(obj) + '\n');
}

/**
 * Launcher state (see run-hook.mjs). Claude Code lets an action through when a
 * hook exceeds its `timeout` or crashes (non-blocking error), so every
 * security hook works against an internal deadline that is SHORTER than the
 * external timeout and refuses when it risks running out of time.
 */
const launcher = () => globalThis.__convivia || null;

/** Milliseconds left before the internal deadline (Infinity when run without the launcher). */
export function remainingMs() {
  const l = launcher();
  return l && l.deadline ? Math.max(0, l.deadline - Date.now()) : Infinity;
}

/** Tools that run a shell command (their `command` input is analysed by the Bash hooks). */
export const SHELL_TOOLS = new Set(['Bash', 'PowerShell', 'Monitor']);
export const isShellTool = (name) => SHELL_TOOLS.has(String(name || ''));
export function shellCommand(input) {
  const ti = (input && input.tool_input) || {};
  return String(ti.command ?? ti.script ?? '');
}

/**
 * Run a hook. `failMode`: 'closed' (security hooks: deny/block on internal
 * error, unreadable input or deadline) or 'open' (quality hooks: exit 0 +
 * systemMessage). The handler returns undefined or one of deny/ask/block/info.
 */
export function runHook({ name, event, failMode }, handler) {
  const fail = (err) => {
    const msg = `hook en erreur (${err && err.message ? err.message : String(err)})`;
    if (failMode === 'open') return emit({ systemMessage: `[hook ${name}] ${msg} : contrôle ignoré.` });
    if (event === 'PreToolUse') return emit(render(deny(`${msg}. Action refusée par prudence (échec fermé) : relance, ou demande au porteur du projet.`), event, name));
    return emit({ decision: 'block', reason: `[hook ${name}] ${msg}. Vérification manuelle nécessaire.` });
  };
  (async () => {
    let input;
    try {
      const raw = await readStdin();
      input = JSON.parse(raw.replace(/^﻿/, ''));
      if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('entrée illisible');
    } catch (e) {
      return fail(e);
    }
    try {
      const ctx = makeCtx(input);
      const res = await handler(input, ctx);
      emit(render(res, event, name));
    } catch (e) {
      fail(e);
    }
  })().finally(() => {
    process.exitCode = 0;
    const l = launcher();
    if (l && l.done) l.done();
  });
}

/** Environment given to every child process started by a hook: no secret, safe modes forced. */
export function sanitizedEnv(base = process.env) {
  const env = {};
  const secretName = new RegExp(`^(?:${SECRET_ENV_VARS.join('|')})$|TOKEN|SECRET|PASSWORD|PASSWD|API_?KEY|PRIVATE|CREDENTIAL|^SUPABASE_(?!URL$)|^DATABASE_URL$|^POSTGRES_|^PG(?:PASSWORD|HOST|USER|SERVICE)$|^FEDAPAY_|^WHATSAPP_|^RESEND_|^SENTRY_|^VERCEL_(?:TOKEN|OIDC)`, 'i');
  for (const [k, v] of Object.entries(base)) {
    if (v === undefined) continue;
    if (secretName.test(k)) continue;
    if (/^(?:NODE_OPTIONS|NODE_PATH|NODE_REPL_EXTERNAL_MODULE|GIT_EXTERNAL_DIFF|GIT_SSH_COMMAND|GIT_ASKPASS|GIT_CONFIG_(?:COUNT|KEY_\d+|VALUE_\d+|PARAMETERS)|GIT_EDITOR|GIT_PAGER|PAGER|EDITOR|VISUAL|BASH_ENV|ENV|PROMPT_COMMAND)$/i.test(k)) continue;
    env[k] = v;
  }
  env.WHATSAPP_MODE = 'simulate';
  env.FEDAPAY_ENV = 'sandbox';
  env.VERCEL_ENV = 'development';
  env.GIT_OPTIONAL_LOCKS = '0';
  env.GIT_TERMINAL_PROMPT = '0';
  env.GIT_PAGER = 'cat';
  return env;
}

/* ------------------------------------------------------------------ */
/* Paths                                                               */
/* ------------------------------------------------------------------ */

export function toSlash(p) {
  return String(p ?? '').replace(/\\/g, '/');
}

export function projectRoot(input) {
  const p = path.resolve(process.env.CLAUDE_PROJECT_DIR || (input && input.cwd) || process.cwd());
  // true case of the folder (Windows is case-insensitive); safe fallback to the given path
  try {
    return fs.realpathSync.native(p);
  } catch {
    return p;
  }
}

function isAbs(s) {
  return s.startsWith('/') || /^[A-Za-z]:\//.test(s);
}

const IS_WIN = process.platform === 'win32';

/** Expand a leading `~`, `$HOME`, `${HOME}`, `%USERPROFILE%`... (known variables only). */
function expandLeadingVar(s) {
  const home = os.homedir();
  const known = {
    HOME: home, USERPROFILE: home, PWD: process.cwd(), TMP: os.tmpdir(), TEMP: os.tmpdir(), TMPDIR: os.tmpdir(),
    APPDATA: process.env.APPDATA, LOCALAPPDATA: process.env.LOCALAPPDATA, HOMEPATH: process.env.HOMEPATH,
  };
  if (s === '~' || s.startsWith('~/')) return toSlash(home) + s.slice(1);
  const m = /^(?:\$\{?([A-Za-z_]+)\}?|%([A-Za-z_]+)%)(?=\/|$)/.exec(s);
  if (m) {
    const v = known[(m[1] || m[2]).toUpperCase()];
    if (v) return toSlash(v) + s.slice(m[0].length);
  }
  return s;
}

/**
 * Git Bash / MSYS / Cygwin / WSL / extended-length forms of a Windows path:
 * `/c/Users/x`, `/cygdrive/c/x`, `/mnt/c/x`, `\\?\C:\x`, `//?/C:/x`  ->  `c:/Users/x`.
 */
function winPathForms(s, winish) {
  let t = s.replace(/^\/\/[?.]\/(?:UNC\/)?/i, (m) => (/UNC/i.test(m) ? '//' : ''));
  if (winish) {
    const m = /^\/(?:cygdrive\/|mnt\/)?([A-Za-z])(?=\/|$)(.*)$/.exec(t);
    if (m) t = `${m[1].toLowerCase()}:${m[2] || '/'}`;
  }
  return t;
}

/** Windows ignores trailing dots / spaces and `::$DATA` streams: `.env.` and `.env ` are `.env`. */
function stripWinQuirks(seg) {
  if (seg === '.' || seg === '..' || /^[A-Za-z]:$/.test(seg)) return seg;
  let t = seg.replace(/:.*$/, '');
  t = t.replace(/[. ]+$/, '');
  return t || seg;
}

/** Real path of the deepest existing ancestor + the not-yet-existing remainder (symlinks, junctions, 8.3 names, true case). */
export function realish(p) {
  let cur = p;
  const rest = [];
  for (let guard = 0; guard < 64; guard++) {
    try {
      const real = toSlash(fs.realpathSync.native(cur)).replace(/^\/\/\?\//, '');
      return rest.length ? real.replace(/\/+$/, '') + '/' + rest.reverse().join('/') : real;
    } catch {
      const trimmed = cur.replace(/\/+$/, '');
      const idx = trimmed.lastIndexOf('/');
      if (!trimmed || idx < 0 || /^[A-Za-z]:$/.test(trimmed)) return p;
      let parent = idx === 0 ? '/' : trimmed.slice(0, idx);
      if (/^[A-Za-z]:$/.test(parent)) parent += '/';
      rest.push(trimmed.slice(idx + 1));
      cur = parent;
    }
  }
  return p;
}

function normalizeAbs(s) {
  const m = /^([A-Za-z]:)(\/.*)?$/.exec(s);
  if (m) return m[1] + path.posix.normalize(m[2] || '/');
  return path.posix.normalize(s);
}

const rootCache = new Map();
function canonRoot(root) {
  if (!rootCache.has(root)) {
    const r = toSlash(root).replace(/\/+$/, '');
    rootCache.set(root, realish(normalizeAbs(winPathForms(r, IS_WIN || /^[A-Za-z]:\//.test(r)))).replace(/\/+$/, ''));
  }
  return rootCache.get(root);
}

/**
 * Canonical absolute path: forward slashes, `..` resolved, Git Bash / WSL /
 * extended forms converted, Windows quirks removed, symlinks and junctions
 * followed (existing part), true case and long names when the path exists.
 */
export function canonPath(p, root, cwd) {
  const r = toSlash(root).replace(/\/+$/, '');
  const winish = IS_WIN || /^[A-Za-z]:\//.test(r);
  let s = winPathForms(expandLeadingVar(toSlash(p)), winish);
  if (!isAbs(s)) {
    const base = cwd ? winPathForms(expandLeadingVar(toSlash(cwd)), winish).replace(/\/+$/, '') : r;
    s = (isAbs(base) ? base : r + '/' + base) + '/' + s;
  }
  s = normalizeAbs(s);
  if (winish) s = s.split('/').map(stripWinQuirks).join('/');
  s = normalizeAbs(s);
  return realish(s);
}

/** Project-relative path, case preserved, forward slashes. Outside the project: the canonical absolute path. */
export function relPath(p, root, cwd) {
  const s = canonPath(p, root, cwd);
  const r = canonRoot(root);
  if (s.toLowerCase() === r.toLowerCase()) return '.';
  if (s.toLowerCase().startsWith(r.toLowerCase() + '/')) return s.slice(r.length + 1);
  return s;
}

/** Normalized for matching: project-relative, lowercase, forward slashes. */
export function normalizePath(p, root, cwd) {
  return relPath(p, root, cwd).toLowerCase();
}

function makeCtx(input) {
  const root = projectRoot(input);
  const cwd = input && input.cwd ? input.cwd : root;
  return {
    root,
    cwd,
    rel: (p) => normalizePath(p, root, cwd),
    relRaw: (p) => relPath(p, root, cwd),
  };
}

/** `secret` for .env*, *.pem, *.key, *.p12 ; `example` for .env.example. */
export function protectedKind(rel) {
  const base = toSlash(rel).split('/').pop().toLowerCase();
  if (base === '.env.example') return 'example';
  if (/^\.env(\..*)?$/.test(base) || base === '.envrc') return 'secret';
  if (/\.(pem|key|p12|pfx|keystore)$/.test(base)) return 'secret';
  if (/^id_(rsa|ed25519|ecdsa|dsa)/.test(base)) return 'secret';
  if (base === 'credentials.json' || /^service-account.*\.json$/.test(base)) return 'secret';
  return null;
}

export const WRITE_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);

export function toolPath(ti) {
  if (!ti) return '';
  return ti.file_path || ti.notebook_path || ti.path || '';
}

/** Text added by an Edit/Write/MultiEdit/NotebookEdit call. */
export function addedContent(tool, ti) {
  if (!ti) return '';
  if (tool === 'Write') return String(ti.content ?? '');
  if (tool === 'Edit') return String(ti.new_string ?? '');
  if (tool === 'MultiEdit') return (ti.edits || []).map((e) => String(e.new_string ?? '')).join('\n');
  if (tool === 'NotebookEdit') return String(ti.new_source ?? '');
  return '';
}

/* ------------------------------------------------------------------ */
/* Secrets                                                             */
/* ------------------------------------------------------------------ */

const VARS = SECRET_ENV_VARS.join('|');
const PLACEHOLDER = /^(?:\.{2,}|…+|<.*>|your[-_ ].*|changeme|change[-_]me|todo|x{3,}|\*+|placeholder|example|\{.*\})$/i;

function isServiceRoleJwt(token) {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return false;
    const payload = JSON.parse(Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
    return payload && payload.role === 'service_role';
  } catch {
    return false;
  }
}

export const lineOf = (text, index) => text.slice(0, index).split('\n').length;

/**
 * Find secrets in text. Returns [{kind, index, line}] — never the secret.
 */
export function findSecrets(text) {
  const t = String(text ?? '');
  const found = [];
  const add = (kind, index) => found.push({ kind, index, line: lineOf(t, index) });
  const simple = [
    ['clé FedaPay secrète (sk_live/sk_sandbox)', /\bsk_(?:live|sandbox)_[A-Za-z0-9]{12,}/g],
    ['clé FedaPay publique live', /\bpk_live_[A-Za-z0-9]{12,}/g],
    ['secret de webhook FedaPay', /\bwh_(?:live|sandbox)_?[A-Za-z0-9]{12,}/g],
    ['jeton Meta/WhatsApp', /\bEAA[A-Za-z0-9]{20,}/g],
    ['clé Supabase sb_secret', /\bsb_secret_[A-Za-z0-9_-]{16,}/g],
    ['clé Resend', /\bre_(?=[A-Za-z0-9_]*\d)[A-Za-z0-9_]{20,}/g],
    ['clé privée PEM', /-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY-----/g],
  ];
  for (const [kind, re] of simple) {
    for (const m of t.matchAll(re)) add(kind, m.index);
  }
  for (const m of t.matchAll(/eyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]*/g)) {
    if (isServiceRoleJwt(m[0])) add('JWT Supabase service_role', m.index);
  }
  // Quoted literal assignment: NAME = "value" / NAME: "value"
  const quoted = new RegExp(`\\b(${VARS})\\b["']?\\s*(?:=|:)\\s*(["'\`])([^"'\`\\r\\n]*)\\2`, 'g');
  for (const m of t.matchAll(quoted)) {
    const v = m[3].trim();
    if (v && !v.startsWith('$') && !PLACEHOLDER.test(v)) add(`valeur littérale de ${m[1]}`, m.index);
  }
  // Unquoted: NAME=value (.env style or inline shell)
  const bare = new RegExp(`(?:^|[\\s;&|(])(?:export\\s+|set\\s+|\\$env:)?(${VARS})=([^\\s"'\`$#<>;&|()]+)`, 'gm');
  for (const m of t.matchAll(bare)) {
    if (!PLACEHOLDER.test(m[2])) add(`valeur littérale de ${m[1]}`, m.index);
  }
  return found;
}

export function refsSecretVar(text) {
  const re = new RegExp(`\\$\\{?(?:env:)?(?:${VARS})\\b|%(?:${VARS})%`, 'i');
  return re.test(String(text ?? ''));
}

/* ------------------------------------------------------------------ */
/* Session state (files changed during the session)                    */
/* ------------------------------------------------------------------ */

function stateDir() {
  return path.join(os.tmpdir(), 'convivia-hooks');
}

function safeId(id) {
  return String(id || 'no-session').replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 80);
}

function stateFile(id) {
  return path.join(stateDir(), safeId(id) + '.json');
}

function withLock(id, fn) {
  const dir = stateDir();
  fs.mkdirSync(dir, { recursive: true });
  const lock = path.join(dir, safeId(id) + '.lock');
  const t0 = Date.now();
  let have = false;
  while (Date.now() - t0 < 3000) {
    try {
      fs.mkdirSync(lock);
      have = true;
      break;
    } catch {
      try {
        if (Date.now() - fs.statSync(lock).mtimeMs > 10000) fs.rmdirSync(lock);
      } catch {
        /* ignore */
      }
      const end = Date.now() + 25;
      while (Date.now() < end) {
        /* short busy wait */
      }
    }
  }
  try {
    return fn();
  } finally {
    if (have) {
      try {
        fs.rmdirSync(lock);
      } catch {
        /* ignore */
      }
    }
  }
}

export function readChangedFiles(sessionId) {
  try {
    const j = JSON.parse(fs.readFileSync(stateFile(sessionId), 'utf8'));
    return Array.isArray(j.files) ? j.files : [];
  } catch {
    return [];
  }
}

function writeAtomic(file, content) {
  const tmp = `${file}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`;
  fs.writeFileSync(tmp, content);
  fs.renameSync(tmp, file);
}

export function addChangedFiles(sessionId, files) {
  withLock(sessionId, () => {
    const set = new Set(readChangedFiles(sessionId));
    for (const f of files) set.add(f);
    writeAtomic(stateFile(sessionId), JSON.stringify({ files: [...set] }));
  });
}

export function clearChangedFiles(sessionId) {
  withLock(sessionId, () => writeAtomic(stateFile(sessionId), JSON.stringify({ files: [] })));
}

/* ------------------------------------------------------------------ */
/* Sub-agent transcripts                                               */
/* ------------------------------------------------------------------ */

/** Tool calls (name + input) found in a JSONL transcript. */
export function readToolUses(file) {
  const out = [];
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return out;
  }
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    let o;
    try {
      o = JSON.parse(line);
    } catch {
      continue;
    }
    const content = (o && o.message && o.message.content) || (o && o.content);
    if (!Array.isArray(content)) continue;
    for (const item of content) {
      if (item && item.type === 'tool_use' && item.name) out.push({ name: item.name, input: item.input || {} });
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Tooling (local binaries, subprocesses)                              */
/* ------------------------------------------------------------------ */

export function localBin(root, rel) {
  const p = path.join(root, rel);
  return fs.existsSync(p) ? p : null;
}

export const BINS = {
  prettier: 'node_modules/prettier/bin/prettier.cjs',
  eslint: 'node_modules/eslint/bin/eslint.js',
  tsc: 'node_modules/typescript/bin/tsc',
  vitest: 'node_modules/vitest/vitest.mjs',
};

/** Run `node <script> ...args`. Never throws. */
export function runNode(script, args, { cwd, timeout = 30000 } = {}) {
  return runProc(process.execPath, [script, ...args], { cwd, timeout });
}

export function runProc(cmd, args, { cwd, timeout = 30000, input, shell = false, env } = {}) {
  // Never outlive the internal deadline of the hook (the launcher refuses past it).
  const left = remainingMs();
  if (left < 400) {
    return { code: null, signal: null, error: new Error('internal deadline reached'), missing: false, timedOut: true, stdout: '', stderr: '' };
  }
  const r = spawnSync(cmd, args, {
    cwd,
    timeout: Math.max(200, Math.min(timeout, left - 300)),
    input,
    shell,
    env: env || sanitizedEnv(),
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
    windowsHide: true,
  });
  return {
    code: r.status,
    signal: r.signal,
    error: r.error || null,
    missing: !!(r.error && r.error.code === 'ENOENT'),
    timedOut: !!(r.error && r.error.code === 'ETIMEDOUT'),
    stdout: r.stdout || '',
    stderr: r.stderr || '',
  };
}

export function npmCliPath() {
  const d = path.dirname(process.execPath);
  for (const p of [
    path.join(d, 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    path.join(d, '..', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js'),
  ]) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

export function tail(text, n = 20) {
  const lines = String(text).split('\n').map((l) => l.replace(/\s+$/, ''));
  while (lines.length && !lines[lines.length - 1]) lines.pop();
  return lines.slice(-n).join('\n');
}

export function head(text, n = 20) {
  return String(text).split('\n').slice(0, n).join('\n');
}

export function isCodeFile(rel) {
  const m = /\.([a-z0-9]+)$/.exec(rel.toLowerCase());
  return !!m && CODE_EXTS.includes(m[1]);
}

export function isTestFile(rel) {
  const r = rel.toLowerCase();
  return /(^|\/)(tests?|__tests__|e2e)\//.test(r) || /\.(test|spec)\.[a-z0-9]+$/.test(r);
}
