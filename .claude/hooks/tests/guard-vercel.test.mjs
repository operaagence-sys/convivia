import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { run, HOOKS_DIR } from './helpers.mjs';

const S = 'guard-vercel.mjs';
const mcp = (name, tool_input = {}, server = 'vercel') => ({ tool_name: `mcp__${server}__${name}`, tool_input });
const d = (input) => run(S, input).decision;

test('lectures (état, journaux, erreurs, projets, documentation) -> autorisées', () => {
  const ok = [
    'list_projects', 'list_deployments', 'get_deployment', 'get_deployment_build_logs', 'get_runtime_logs', 'get_runtime_errors', 'get_project',
    'list_teams', 'search_vercel_documentation', 'search_docs', 'get_deployment_events', 'list_deployment_aliases',
  ];
  for (const n of ok) {
    assert.equal(d(mcp(n, { projectId: 'prj_x' })), 'none', n);
    assert.equal(d(mcp(n, {}, 'claude_ai_Vercel')), 'none', `claude.ai ${n}`);
  }
});

test('les autres outils ne sont pas concernés', () => {
  assert.equal(d({ tool_name: 'Bash', tool_input: { command: 'ls' } }), 'none');
  assert.equal(d(mcp('execute_sql', {}, 'supabase')), 'none');
});

test('écritures, déploiement, achat de domaine, DNS, firewall, partage -> deny', () => {
  const bad = [
    'deploy_to_vercel', 'create_deployment', 'redeploy', 'promote_deployment', 'rollback_deployment', 'cancel_deployment', 'delete_deployment',
    'create_project', 'update_project', 'delete_project', 'add_domain', 'remove_domain', 'purchase_domain', 'buy_domain', 'register_domain',
    'transfer_domain', 'create_dns_record', 'update_dns_record', 'delete_dns_record', 'update_firewall_rules', 'add_firewall_rule',
    'invalidate_cache', 'create_shareable_link', 'share_deployment', 'run_sandbox_command', 'create_sandbox', 'exec_command',
    'set_environment_variable', 'create_env_var', 'update_env', 'create_blob_store', 'update_edge_config', 'create_comment', 'add_member',
    'create_webhook', 'create_token', 'rotate_secret',
  ];
  for (const n of bad) assert.equal(d(mcp(n, { projectId: 'prj_x' })), 'deny', n);
  assert.equal(d(mcp('purchase_domain', {}, 'claude_ai_Vercel')), 'deny');
});

test('déchiffrer ou révéler des valeurs (variables, secrets, clés, facturation) -> deny même en lecture', () => {
  const bad = [
    'get_environment_variables', 'list_environment_variables', 'list_env_vars', 'get_project_env', 'get_env_value', 'decrypt_env', 'get_decrypted_env',
    'list_secrets', 'get_secret', 'get_token', 'list_tokens', 'list_api_keys', 'get_kms_key', 'list_kms_keys', 'get_billing', 'get_payment_methods',
    'list_invoices', 'list_webhooks', 'get_edge_config_items', 'get_blob', 'list_sandboxes', 'get_sandbox_command_output', 'list_log_drains',
  ];
  for (const n of bad) assert.equal(d(mcp(n, { projectId: 'prj_x' })), 'deny', n);
  // an innocent read tool asked to reveal a value
  assert.equal(d(mcp('get_project', { decrypt: true })), 'deny');
  assert.equal(d(mcp('get_project', { options: { revealValues: 'yes' } })), 'deny');
  assert.equal(d(mcp('get_project', { decrypt: false })), 'none');
});

test('outil inconnu, nom inhabituel ou camouflé -> deny', () => {
  const bad = [
    'frobnicate', 'do_something', 'deployments', 'fetch_deployment', 'read_logs', 'check_domain_availability', 'inspect_webhook', '',
    'deploy__get_project', 'get-project', 'get project', 'GET_PROJECT; deploy', 'get__deploy',
  ];
  for (const n of bad) assert.equal(d(mcp(n)), 'deny', JSON.stringify(n));
  assert.equal(d({ tool_name: 'mcp__vercel', tool_input: {} }), 'deny');
  assert.equal(d({ tool_name: 'mcp__claude_ai_Vercel', tool_input: {} }), 'deny');
  assert.equal(d({ tool_name: 'mcp__other_vercel_tools__create_thing', tool_input: {} }), 'deny');
});

test('panne du hook (entrée illisible) -> refus, jamais autorisation silencieuse', () => {
  const r = run(S, null, { raw: '{{{' });
  assert.equal(r.code, 0);
  assert.equal(r.decision, 'deny');
  assert.equal(run(S, null, { raw: '[]' }).decision, 'deny');
  assert.equal(run(S, null, { raw: '' }).decision, 'deny');
});

test('settings.json : branché sur tous les connecteurs Vercel, échec fermé, lanceur', () => {
  const settings = JSON.parse(fs.readFileSync(path.join(HOOKS_DIR, '..', 'settings.json'), 'utf8'));
  const groups = settings.hooks.PreToolUse.filter((g) => g.hooks.some((h) => h.args[1] === 'guard-vercel'));
  assert.equal(groups.length, 1);
  const re = new RegExp(`^(?:${groups[0].matcher})$`);
  for (const t of ['mcp__vercel__deploy_to_vercel', 'mcp__claude_ai_Vercel__get_project', 'mcp__x_vercel__y']) assert.match(t, re, t);
  assert.doesNotMatch('mcp__supabase__execute_sql', re);
  const h = groups[0].hooks[0];
  assert.match(h.args[0], /hooks\/run-hook\.mjs$/);
  assert.ok(!h.args.includes('--fail=open'));
});
