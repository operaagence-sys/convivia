import 'server-only';
import { createServiceRoleClient } from '@/lib/supabase/admin';
import { createAuthOnlyClient } from '@/lib/supabase/auth-only';
import { getClientIp } from './client-ip';
import { hashLoginIdentifier, secondsUntil } from './identifier';
import { CODE_PATTERN, computeCodeHmac } from './login-code';
import { waitForMinimumVerifyDuration } from './timing';
import type { VerifyResult } from './types';

/**
 * Vérification du code (TRD § 7.1, D24, D47, D52, D58). C'est la base qui vérifie le code
 * (`login_code_verify`: empreinte, essais, blocage, IP, cas admin jamais « ok »). Supabase Auth
 * ne sert qu'à ouvrir la session. Ordre voulu après un `ok`:
 * 1. `createUser` (compte déjà confirmé; « existe déjà » ignoré sans rien révéler) ;
 * 2. `generateLink` magiclink (client admin) et contrôle de `verification_type` ;
 * 3. IMMÉDIATEMENT `verifyOtp` avec le jeton obtenu (client Auth réduit, cookies de session) ;
 * 4. `ensure_organizer`.
 * Jamais de journal de la réponse de `generateLink` (`email_otp`, `hashed_token`, `action_link`)
 * ni d'objet d'erreur entier: seulement `status` et `code`. Durée plancher sur tous les chemins.
 */
export async function verifyLoginCode(
  email: string | undefined,
  rawCode: unknown,
): Promise<VerifyResult> {
  if (!email) return { ok: false, error: { kind: 'missingEmail' } };
  // Un code mal formé ne coûte pas d'essai : il ne peut pas être juste.
  const code = typeof rawCode === 'string' ? rawCode.trim() : '';
  if (!CODE_PATTERN.test(code)) return { ok: false, error: { kind: 'wrong' } };

  const startedAt = Date.now();
  try {
    return await checkCode(email, code);
  } finally {
    await waitForMinimumVerifyDuration(startedAt);
  }
}

async function checkCode(emailAccount: string, code: string): Promise<VerifyResult> {
  const service = createServiceRoleClient();
  const identifierHash = hashLoginIdentifier(emailAccount);
  const ip = await getClientIp();
  const now = Date.now();

  const verified = await service.rpc('login_code_verify', {
    p_identifier_hash: identifierHash,
    p_ip_hash: ip.hash,
    p_ip48_hash: ip.hash48,
    p_code_hmac: computeCodeHmac({ identifierHash, code, emailAccount }),
    p_email: emailAccount,
  });
  const decision = verified.data?.[0];
  if (verified.error || !decision) {
    console.error('[auth] login_code_verify a échoué', { code: verified.error?.code });
    // `22023` = argument mal formé (bogue): erreur neutre; sinon panne de la base.
    return {
      ok: false,
      error: { kind: verified.error?.code === '22023' ? 'unexpected' : 'unavailable' },
    };
  }
  if (decision.result === 'locked' || decision.result === 'ip_limited') {
    // Même message de blocage (la limite par IP n'est pas révélée).
    return {
      ok: false,
      error: { kind: 'blocked', retryAfterSeconds: secondsUntil(decision.retry_at, now, 900) },
    };
  }
  if (decision.result !== 'ok') return { ok: false, error: { kind: 'wrong' } };

  // Code juste. Le compte est créé par le serveur (inscription publique désactivée côté
  // Supabase); un compte existant répond 422 (`email_exists`): ignoré, la suite est identique.
  const created = await service.auth.admin.createUser({ email: emailAccount, email_confirm: true });
  if (created.error && !isAlreadyRegistered(created.error)) {
    console.error('[auth] createUser a échoué', {
      status: created.error.status,
      code: created.error.code,
    });
    return { ok: false, error: { kind: 'unavailable' } };
  }

  const link = await service.auth.admin.generateLink({ type: 'magiclink', email: emailAccount });
  if (link.error || !link.data?.properties) {
    console.error('[auth] generateLink a échoué', {
      status: link.error?.status,
      code: link.error?.code,
    });
    return { ok: false, error: { kind: 'unavailable' } };
  }
  const { hashed_token: tokenHash, verification_type: verificationType } = link.data.properties;
  if (verificationType !== 'magiclink' || !tokenHash) {
    // Ne jamais consommer un jeton d'un autre type (ex. `signup`, `recovery`): on s'arrête.
    console.error('[auth] generateLink: type de lien inattendu');
    return { ok: false, error: { kind: 'unexpected' } };
  }

  const auth = await createAuthOnlyClient(ip.forwarded);
  const { data, error } = await auth.auth.verifyOtp({ token_hash: tokenHash, type: 'magiclink' });
  if (error || !data.user) {
    // 429, 5xx ou service injoignable: on le dit, sans session. 403 (`access_denied` du hook
    // d'accès) et le reste: message neutre, aucune session.
    const status = error?.status ?? 400;
    const unreachable =
      error?.name === 'AuthRetryableFetchError' || status === 429 || status >= 500;
    console.error('[auth] verifyOtp a échoué', { status: error?.status, code: error?.code });
    return { ok: false, error: { kind: unreachable ? 'unavailable' : 'wrong' } };
  }

  const ensured = await service.rpc('ensure_organizer', { p_user_id: data.user.id });
  const organizer = ensured.data?.[0];
  if (ensured.error || !organizer) {
    // Compte admin (D23, filet de sécurité) ou compte inattendu : on ferme la session ouverte.
    await auth.auth.signOut({ scope: 'local' });
    const isAdmin = ensured.error?.message?.includes('admin_account') === true;
    if (!isAdmin) console.error('[auth] ensure_organizer a échoué', { code: ensured.error?.code });
    return { ok: false, error: { kind: isAdmin ? 'wrong' : 'unexpected' } };
  }

  return { ok: true, next: organizer.profile_complete ? '/dashboard' : '/welcome' };
}

function isAlreadyRegistered(error: { code?: string }): boolean {
  return error.code === 'email_exists';
}
