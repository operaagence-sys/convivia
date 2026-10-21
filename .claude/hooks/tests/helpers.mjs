// Test helpers (not a test file). Fake secrets are built at runtime so that no
// real secret pattern ever appears in clear in the repository.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const HOOKS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function tmpDir(prefix = 'convivia-hook-test-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

let sharedProject;
/** An empty temp project directory (never the real project). */
export function emptyProject() {
  if (!sharedProject) sharedProject = tmpDir('convivia-proj-');
  return sharedProject;
}

/**
 * Run a hook script with a JSON payload on stdin.
 * @returns {{code:number, json:any, decision:string, reason:string, stdout:string, stderr:string}}
 */
export function run(script, input, { project, env = {}, raw } = {}) {
  const proj = project || emptyProject();
  const payload = raw !== undefined ? raw : JSON.stringify({ cwd: proj, session_id: 'test-session', ...input });
  const r = spawnSync(process.execPath, [path.join(HOOKS_DIR, script)], {
    input: payload,
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PROJECT_DIR: proj, ...env },
    timeout: 120000,
  });
  let json = null;
  try {
    json = r.stdout.trim() ? JSON.parse(r.stdout) : null;
  } catch {
    /* leave null */
  }
  let decision = 'none';
  let reason = '';
  if (json && json.hookSpecificOutput) {
    decision = json.hookSpecificOutput.permissionDecision;
    reason = json.hookSpecificOutput.permissionDecisionReason || '';
  } else if (json && json.decision) {
    decision = json.decision;
    reason = json.reason || '';
  } else if (json && json.systemMessage) {
    decision = 'message';
    reason = json.systemMessage;
  }
  return { code: r.status, json, decision, reason, stdout: r.stdout, stderr: r.stderr };
}

export const bash = (command, extra = {}) => ({ tool_name: 'Bash', tool_input: { command }, ...extra });
export const write = (file_path, content) => ({ tool_name: 'Write', tool_input: { file_path, content } });
export const edit = (file_path, new_string, old_string = 'x') => ({ tool_name: 'Edit', tool_input: { file_path, old_string, new_string } });
export const multiEdit = (file_path, edits) => ({ tool_name: 'MultiEdit', tool_input: { file_path, edits } });
export const read = (file_path) => ({ tool_name: 'Read', tool_input: { file_path } });

const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
export const fake = {
  fedapayLive: () => 'sk_' + 'live_' + 'x'.repeat(32),
  fedapaySandbox: () => 'sk_' + 'sandbox_' + 'y'.repeat(32),
  fedapayPkLive: () => 'pk_' + 'live_' + 'z'.repeat(32),
  webhook: () => 'wh_' + 'live' + 'q'.repeat(30),
  meta: () => 'EA' + 'A' + 'B'.repeat(40),
  sbSecret: () => 'sb_' + 'secret_' + 'a'.repeat(30),
  resend: () => 're_' + 'Ab12'.repeat(8),
  pem: () => '-----BEGIN ' + 'PRIVATE KEY-----',
  jwt: (role) => `${b64u({ alg: 'HS256', typ: 'JWT' })}.${b64u({ iss: 'supabase', role })}.${'s'.repeat(20)}`,
};
