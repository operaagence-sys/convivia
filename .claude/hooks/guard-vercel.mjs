// Hook 14 — PreToolUse (MCP Vercel: mcp__vercel__* and any connector whose name contains "vercel").
// The Vercel connector is READ-ONLY for agents (decision of the project owner): deploying and every
// remote action are reserved to the owner. Strict allowlist, deny by default:
//  - the tool name (after the server name) must start with list_, get_ or search_ ;
//  - even then it is refused when a word of its name is a write verb (deploy, promote, create,
//    purchase…) or points at something secret or sensitive (env variables, secrets, tokens, keys,
//    KMS, billing / payment, webhooks, Blob, Edge Config, Sandbox…) ;
//  - unknown tools, odd names and any "decrypt / reveal" argument are refused.
// Names are matched as whole words (split on non-alphanumerics): « get_deployment_build_logs » is
// allowed, « redeploy » or « get_project_env » are not. Fail closed (see run-hook.mjs).
import { runHook, deny } from './lib/common.mjs';

const READ_PREFIXES = ['list_', 'get_', 'search_'];

/** Write / action verbs (whole words). A name containing one is refused, even after list_/get_/search_. */
const ACTION_WORDS = new Set([
  'deploy', 'deploys', 'redeploy', 'promote', 'rollback', 'rollbacks', 'create', 'update', 'delete', 'remove', 'add', 'set', 'put', 'patch', 'post',
  'write', 'edit', 'rename', 'move', 'upload', 'purchase', 'buy', 'register', 'renew', 'transfer', 'invalidate', 'purge', 'run', 'exec', 'execute',
  'start', 'stop', 'kill', 'cancel', 'pause', 'resume', 'restart', 'enable', 'disable', 'apply', 'import', 'export', 'share', 'unshare', 'invite',
  'grant', 'revoke', 'connect', 'disconnect', 'install', 'uninstall', 'link', 'unlink', 'approve', 'reject', 'merge', 'reset', 'rotate', 'regenerate',
  'generate', 'sign', 'login', 'logout', 'send', 'comment', 'reply', 'resolve', 'publish', 'toggle', 'trigger', 'retry', 'replay', 'schedule',
  'assign', 'attach', 'detach', 'claim', 'accept', 'decline', 'verify', 'configure', 'override', 'unlock', 'lock', 'dismiss', 'clear', 'flush',
  'sync', 'rm', 'mv', 'cp', 'drop', 'truncate', 'destroy', 'cleanup', 'prune', 'submit', 'bypass', 'allow', 'ban',
]);

/** Secret / sensitive subjects (whole words): refused even for a read. */
const SENSITIVE_WORDS = new Set([
  'env', 'envs', 'variable', 'variables', 'var', 'vars', 'secret', 'secrets', 'token', 'tokens', 'credential', 'credentials', 'key', 'keys', 'kms',
  'decrypt', 'decrypted', 'decryption', 'encrypt', 'password', 'passwords', 'passphrase', 'oidc', 'sensitive', 'private', 'value', 'values',
  'billing', 'payment', 'payments', 'card', 'cards', 'invoice', 'invoices', 'webhook', 'webhooks', 'drain', 'drains', 'blob', 'blobs', 'sandbox',
  'sandboxes', 'firewall', 'waf', 'cert', 'certs', 'certificate', 'certificates',
]);
/** Compound subjects (matched on the joined name). */
const SENSITIVE_PHRASES = ['edge_config', 'global_config', 'environment_variable', 'env_var', 'api_key', 'access_key'];

const SENSITIVE_ARG = /decrypt|reveal|unmask|show_?secret|include_?(?:secret|value|token)|with_?(?:secret|value)/i;

function sensitiveArg(value, depth = 0) {
  if (!value || typeof value !== 'object' || depth > 4) return false;
  for (const [k, v] of Object.entries(value)) {
    if (SENSITIVE_ARG.test(k) && v !== false && v !== null && v !== undefined && v !== 0 && v !== '') return true;
    if (sensitiveArg(v, depth + 1)) return true;
  }
  return false;
}

/** Returns a reason (string) when the tool must be refused, otherwise ''. Exported for tests. */
export function vercelRefusal(tool, toolInput) {
  const parts = String(tool).split('__');
  // mcp__<server>__<tool>: everything after the server name, so that « deploy__get_x » is not read as « get_x ».
  const op = parts.slice(2).join('_').toLowerCase();
  if (!op) return 'nom d’outil absent';
  if (!/^[a-z][a-z0-9_]*$/.test(op)) return 'nom d’outil inhabituel';
  if (!READ_PREFIXES.some((p) => op.startsWith(p))) return 'ce n’est pas un outil de lecture (list_ / get_ / search_)';
  const words = op.split('_').filter(Boolean);
  const action = words.find((w) => ACTION_WORDS.has(w));
  if (action) return `le nom contient « ${action} » (action d’écriture)`;
  const sensitive = words.find((w) => SENSITIVE_WORDS.has(w)) || SENSITIVE_PHRASES.find((p) => op.includes(p));
  if (sensitive) return `le nom vise un sujet sensible (« ${sensitive} » : variables, secrets, clés, facturation, webhooks, Blob, Edge Config, Sandbox…)`;
  if (sensitiveArg(toolInput)) return 'un argument demande de déchiffrer ou de révéler une valeur';
  return '';
}

runHook({ name: 'guard-vercel', event: 'PreToolUse', failMode: 'closed' }, (input) => {
  const tool = String(input.tool_name || '');
  if (!/^mcp__.*vercel/i.test(tool)) return undefined;
  const why = vercelRefusal(tool, input.tool_input);
  if (!why) return undefined;
  return deny(`Outil MCP Vercel « ${tool.split('__').slice(2).join('__') || tool} » refusé : ${why}. Le connecteur Vercel est en lecture seule pour les agents (état et journaux de déploiement, erreurs, projets, documentation) ; déploiement, variables d’environnement, domaines et toute autre action distante sont réservés au porteur du projet.`);
});
