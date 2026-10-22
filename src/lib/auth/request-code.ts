import 'server-only';
import { after } from 'next/server';
import { sendLoginCodeEmail } from '@/lib/email';
import { createServiceRoleClient } from '@/lib/supabase/admin';
import { getClientIp } from './client-ip';
import { hashLoginIdentifier, parseEmail, secondsUntil } from './identifier';
import { computeCodeHmac, generateLoginCode } from './login-code';
import { waitForMinimumDuration } from './timing';
import type { CodeRequestResult } from './types';

/**
 * Demande d'un code de connexion (TRD § 7.1, D23, D47, D52, D58). Convivia fabrique le code ;
 * Supabase Auth n'intervient pas ici (ni `createUser`, ni `signInWithOtp`). Ordre voulu:
 * 1. validation de l'adresse (`emailAccount`: minuscules, sans espaces) ;
 * 2. empreintes (quota, IP /64 et /48), code tiré par `crypto.randomInt` et son empreinte ;
 * 3. `login_code_issue`: la base décide seule (limites, plafonds, cas admin) et ne garde que
 *    l'empreinte du code ; `deliver = false` pour un admin: même réponse, rien n'est envoyé ;
 * 4. si `deliver`, l'e-mail part dans `after()`, APRÈS la réponse: sa durée ne trahit rien.
 * Toute la suite d'étapes dure au moins `MIN_CODE_REQUEST_MS` (voir `timing.ts`). Les réponses
 * n'indiquent jamais si le compte existe. Aucun journal ne contient l'adresse, l'IP ni le code.
 */
export async function requestLoginCode(rawEmail: unknown): Promise<CodeRequestResult> {
  const emailAccount = parseEmail(rawEmail);
  if (!emailAccount) return { ok: false, error: { kind: 'invalid' } };

  const startedAt = Date.now();
  try {
    return await issueCode(emailAccount);
  } finally {
    await waitForMinimumDuration(startedAt);
  }
}

async function issueCode(emailAccount: string): Promise<CodeRequestResult> {
  const service = createServiceRoleClient();
  const identifierHash = hashLoginIdentifier(emailAccount);
  const ip = await getClientIp();
  const code = generateLoginCode();
  const now = Date.now();

  const issued = await service.rpc('login_code_issue', {
    p_identifier_hash: identifierHash,
    p_ip_hash: ip.hash,
    p_ip48_hash: ip.hash48,
    p_code_hmac: computeCodeHmac({ identifierHash, code, emailAccount }),
    p_email: emailAccount,
  });
  const decision = issued.data?.[0];
  if (issued.error || !decision) {
    // `22023` = argument mal formé (bogue): même erreur générale, journalisée par son code.
    console.error('[auth] login_code_issue a échoué', { code: issued.error?.code });
    return { ok: false, error: { kind: 'sendFailed' } };
  }
  if (!decision.allowed) {
    // `too_soon` (renvoi avant 60 s), `hourly_cap` (3 codes/h): messages dédiés. `locked` (D52),
    // `ip_limited` et `global_cap`: un seul message de blocage, qui ne révèle pas la cause.
    // `global_cap`: événement fixe (sans adresse, IP ni code), pour l'alerte quand Sentry sera actif.
    if (decision.reason === 'global_cap') console.error('[auth] login_code_global_cap');
    const kind =
      decision.reason === 'hourly_cap'
        ? 'hourlyLimit'
        : decision.reason === 'too_soon'
          ? 'tooSoon'
          : 'blocked';
    return {
      ok: false,
      error: { kind, retryAfterSeconds: secondsUntil(decision.retry_at, now) },
    };
  }

  if (decision.deliver) {
    // Après la réponse: un échec d'envoi n'est que journalisé (événement fixe, sans destinataire
    // ni code) et n'est jamais montré différemment selon le destinataire.
    after(async () => {
      try {
        await sendLoginCodeEmail({ to: emailAccount, code });
      } catch (error) {
        const detail = error as { reason?: unknown; status?: unknown };
        console.error('[auth] login_code_email_failed', {
          reason: typeof detail.reason === 'string' ? detail.reason : undefined,
          status: typeof detail.status === 'number' ? detail.status : undefined,
        });
      }
    });
  }
  return { ok: true };
}
