// Launcher of every hook:  node run-hook.mjs <hook-name> --event=<Event> --budget=<ms> [--fail=open]
//
// Why a launcher: Claude Code lets an action through when a hook crashes (exit 1),
// cannot be loaded (syntax error in a shared module) or exceeds its `timeout`.
// This launcher makes the security hooks FAIL CLOSED:
//  - exit code 2 + stderr (a blocking error for PreToolUse) when the hook cannot be
//    loaded, throws outside its own handler, or exceeds its internal budget (always
//    shorter than the `timeout` of settings.json);
//  - integrity check of the hooks and of settings.json before any hook code is
//    imported (see lib/integrity.mjs and seal.mjs);
//  - `globalThis.__convivia.deadline`, honoured by lib/common.mjs (child processes
//    never outlive the budget).
// Hooks of quality (`--fail=open`) only report the problem.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { verifyManifest } from './lib/integrity.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const [, , name = '', ...flags] = process.argv;
const opt = (key) => {
  const f = flags.find((x) => x.startsWith(`--${key}=`));
  return f ? f.slice(key.length + 3) : '';
};
const failOpen = opt('fail') === 'open';
const event = opt('event');
const budget = Math.max(500, Number(opt('budget')) || 8000);

function write(fd, text) {
  try {
    fs.writeSync(fd, text);
  } catch {
    /* nothing more can be done */
  }
}

function fatal(message) {
  if (failOpen) {
    write(1, JSON.stringify({ systemMessage: `[hook ${name}] ${message} : contrôle ignoré.` }) + '\n');
    process.exit(0);
  }
  write(2, `[hook ${name}] ${message}. Action refusée par prudence (échec fermé).\n`);
  process.exit(2);
}

const timer = setTimeout(() => fatal(`délai interne dépassé (${budget} ms)`), budget);
timer.unref();
globalThis.__convivia = { name, event, deadline: Date.now() + budget, failOpen, done: () => clearTimeout(timer) };
process.on('uncaughtException', (e) => fatal(`erreur non gérée (${e && e.message ? e.message : e})`));
process.on('unhandledRejection', (e) => fatal(`promesse rejetée (${e && e.message ? e.message : e})`));

const script = path.join(HERE, `${path.basename(name)}.mjs`);
if (!name || !fs.existsSync(script)) fatal(`script introuvable (${name || 'nom manquant'})`);

const integrity = verifyManifest(path.resolve(HERE, '..'));
if (!integrity.ok) {
  const detail = integrity.problems.slice(0, 5).join(' ; ');
  const msg = `intégrité des hooks non vérifiée : ${detail}. Le porteur du projet doit relire le changement puis lancer « node .claude/hooks/seal.mjs » dans un terminal`;
  if (failOpen) fatal(msg);
  if (event === 'PreToolUse') {
    write(1, JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'ask', permissionDecisionReason: `[hook ${name}] ${msg}.` } }) + '\n');
    process.exit(0);
  }
  fatal(msg);
}

try {
  await import(pathToFileURL(script).href);
} catch (e) {
  fatal(`chargement impossible (${e && e.message ? e.message : e})`);
}
