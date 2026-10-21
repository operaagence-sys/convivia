import test from 'node:test';
import assert from 'node:assert/strict';
import { run, bash, fake } from './helpers.mjs';

const S = 'guard-live-keys.mjs';
const d = (input) => run(S, input).decision;

test('modes live et garde-fou contourné -> deny', () => {
  const denied = [
    'WHATSAPP_MODE=live npm run dev', 'whatsapp_mode=LIVE node x.js', 'export WHATSAPP_MODE=live', 'WHATSAPP_MODE="live" npm start',
    "WHATSAPP_MODE='live' npm start", '$env:WHATSAPP_MODE = "live"; npm run dev', 'set WHATSAPP_MODE=live', 'FEDAPAY_ENV=live npm run dev',
    'VERCEL_ENV=production npm run build', 'cd x && VERCEL_ENV=production node a.js', 'env VERCEL_ENV=production node a.js',
    'vercel env add WHATSAPP_MODE=live',
  ];
  for (const c of denied) assert.equal(d(bash(c)), 'deny', c);
});

test('clés live et API réelles -> deny', () => {
  const denied = [
    `curl -u ${fake.fedapayLive()} x`, 'echo sk_' + 'live_abc', 'echo pk_' + 'live_abc', 'curl https://graph.facebook.com/v21.0/123456/messages -d {}',
    'curl https://graph.facebook.com/messages', 'curl https://api.fedapay.com/v1/transactions', 'curl "https://API.FEDAPAY.COM/v1/x"',
    'vercel env pull .env.local --environment=production', 'vercel env pull --environment production', 'vercel env pull .env.prod production',
    'vercel pull --environment=prod', 'npx vercel env pull --environment=production', 'vercel env pull -y .x --environment=prod',
  ];
  for (const c of denied) assert.equal(d(bash(c)), 'deny', c);
});

test('cas légitimes autorisés', () => {
  const ok = [
    'WHATSAPP_MODE=simulate npm run dev', 'WHATSAPP_MODE=test npm run dev', 'FEDAPAY_ENV=sandbox npm run dev', 'VERCEL_ENV=preview npm run build',
    'curl https://sandbox-api.fedapay.com/v1/transactions', 'curl https://graph.facebook.com/v21.0/123/message_templates',
    'vercel env pull .env.local --environment=development', 'vercel env pull --environment=preview', 'vercel env pull',
    'vercel --version', 'grep "WHATSAPP_MODE === \'live\'" src -r', 'grep -r "VERCEL_ENV !== \'production\'" src', 'npm run build',
    'echo WHATSAPP_MODE is live in production', 'git status',
  ];
  for (const c of ok) assert.equal(d(bash(c)), 'none', c);
});

test('la raison renvoie à CLAUDE.md § 5 ; autres outils ignorés', () => {
  const r = run(S, bash('WHATSAPP_MODE=live npm start'));
  assert.match(r.reason, /CLAUDE\.md § 5/);
  assert.equal(d({ tool_name: 'Write', tool_input: { file_path: 'a.md', content: 'WHATSAPP_MODE=live' } }), 'none');
});

test('échec fermé', () => {
  assert.equal(run(S, null, { raw: 'x' }).decision, 'deny');
});
