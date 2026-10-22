import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { CODE_VALIDITY_MINUTES, RESEND_COOLDOWN_SECONDS } from '@/lib/auth/constants';

const toml = readFileSync(join(process.cwd(), 'supabase', 'config.toml'), 'utf8');

function section(name: string): string {
  const start = toml.indexOf(`\n[${name}]`);
  expect(start).toBeGreaterThan(-1);
  const rest = toml.slice(start + 1);
  const next = rest.slice(1).search(/^\[/m);
  return next === -1 ? rest : rest.slice(0, next + 1);
}

describe('supabase/config.toml (Auth local et CI)', () => {
  const email = section('auth.email');

  it('le jeton generateLink ne vit que 60 s (les 10 min du code sont dans login_attempts)', () => {
    expect(email).toMatch(/^otp_expiry = 60$/m);
    // La durée affichée dans l'e-mail vient de notre constante, pas de ce réglage.
    expect(CODE_VALIDITY_MINUTES).toBe(10);
  });

  it('un code de 6 chiffres, un envoi par minute', () => {
    expect(email).toMatch(/^otp_length = 6$/m);
    expect(email).toMatch(new RegExp(`^max_frequency = "${RESEND_COOLDOWN_SECONDS}s"$`, 'm'));
  });

  it('les inscriptions publiques sont fermées, « Confirm email » reste désactivé', () => {
    expect(section('auth')).toMatch(/^enable_signup = false$/m);
    expect(email).toMatch(/^enable_signup = false$/m);
    expect(email).toMatch(/^enable_confirmations = false$/m);
  });

  it('au plus 10 vérifications de code par 5 minutes et par IP', () => {
    expect(section('auth.rate_limit')).toMatch(/^token_verifications = 10$/m);
  });

  it('le hook Custom Access Token pointe vers auth_hooks.custom_access_token', () => {
    const hook = section('auth.hook.custom_access_token');
    expect(hook).toMatch(/^enabled = true$/m);
    expect(hook).toMatch(/^uri = "pg-functions:\/\/postgres\/auth_hooks\/custom_access_token"$/m);
  });

  it('le hook Send Email est une fonction Postgres (refuse tout) et non une Edge Function', () => {
    const hook = section('auth.hook.send_email');
    expect(hook).toMatch(/^enabled = true$/m);
    expect(hook).toMatch(/^uri = "pg-functions:\/\/postgres\/auth_hooks\/send_email"$/m);
    expect(toml).not.toMatch(/\[functions\.send-auth-email\]/);
    expect(toml).not.toMatch(/^\[auth\.email\.smtp\]/m);
  });

  it('la connexion par téléphone est désactivée', () => {
    expect(section('auth.sms')).toMatch(/^enable_signup = false$/m);
  });

  it('les numéros ne sont jamais confirmés automatiquement (confirmations SMS activées)', () => {
    expect(section('auth.sms')).toMatch(/^enable_confirmations = true$/m);
  });
});
