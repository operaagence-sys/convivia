import 'server-only';

import { randomUUID } from 'node:crypto';

import { loginCodeEmail } from '@/content/emails/login-code.fr';
import { CODE_VALIDITY_MINUTES } from '@/lib/auth/constants';
import { getServerEnv, requireServerEnv } from '@/lib/env/server';

import { parseMailbox, resolveEmailConfig, resolveEmailDelivery } from './policy';

const RESEND_URL = 'https://api.resend.com/emails';
const REQUEST_TIMEOUT_MS = 8000;

export type EmailFailureReason =
  'invalid_input' | 'config' | 'network' | 'rejected' | 'unavailable';

/**
 * Échec d'envoi. Le message est fixe: ni adresse, ni code, ni corps de réponse Resend.
 * `reason` (et `status` HTTP) servent au diagnostic sans rien divulguer.
 */
export class EmailSendError extends Error {
  readonly reason: EmailFailureReason;
  readonly status?: number;

  constructor(reason: EmailFailureReason, status?: number) {
    super("L'envoi de l'e-mail du code de connexion a échoué.");
    this.name = 'EmailSendError';
    this.reason = reason;
    if (status !== undefined) this.status = status;
  }
}

type Attempt = { ok: true } | { ok: false; reason: EmailFailureReason; status?: number };

async function post(apiKey: string, body: string, idempotencyKey: string): Promise<Attempt> {
  let response: Response;
  try {
    response = await fetch(RESEND_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body,
      cache: 'no-store',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    return { ok: false, reason: 'network' };
  }
  // Le corps de la réponse n'est jamais lu (il peut citer l'adresse).
  if (response.ok) return { ok: true };
  const retryable = response.status >= 500 || response.status === 429;
  return { ok: false, reason: retryable ? 'unavailable' : 'rejected', status: response.status };
}

/**
 * Envoie le code de connexion par Resend. Lève `EmailSendError` en cas d'échec.
 * Hors production, une adresse absente de EMAIL_TEST_ALLOWLIST ne reçoit rien et la fonction
 * réussit quand même (aucune différence observable: pas d'oracle). En production, la liste
 * blanche est ignorée.
 */
export async function sendLoginCodeEmail(input: { to: string; code: string }): Promise<void> {
  const env = getServerEnv();
  const production = env.VERCEL_ENV === 'production';

  const recipient = parseMailbox(input.to);
  if (!recipient || recipient.name !== undefined) throw new EmailSendError('invalid_input');

  if (
    resolveEmailDelivery({
      production,
      allowlist: env.EMAIL_TEST_ALLOWLIST,
      to: recipient.address,
    }) === 'skip'
  ) {
    return;
  }

  let config: ReturnType<typeof resolveEmailConfig>;
  let message: ReturnType<typeof loginCodeEmail>;
  let apiKey: string;
  try {
    // EMAIL_REPLY_TO vide ('') = pas d'en-tête; absent = défaut support@convivia.app.
    config = resolveEmailConfig({
      production,
      from: env.EMAIL_FROM,
      replyTo: env.EMAIL_REPLY_TO,
    });
    apiKey = requireServerEnv('RESEND_API_KEY').RESEND_API_KEY;
  } catch {
    throw new EmailSendError('config');
  }
  try {
    message = loginCodeEmail(input.code, CODE_VALIDITY_MINUTES);
  } catch {
    throw new EmailSendError('invalid_input');
  }

  const body = JSON.stringify({
    from: config.from,
    to: [recipient.address],
    subject: message.subject,
    html: message.html,
    text: message.text,
    ...(config.replyTo ? { reply_to: config.replyTo } : {}),
  });

  // Même clé pour la nouvelle tentative: Resend ne renvoie pas deux fois le même message.
  const idempotencyKey = randomUUID();
  let attempt = await post(apiKey, body, idempotencyKey);
  if (!attempt.ok && (attempt.reason === 'network' || attempt.reason === 'unavailable')) {
    attempt = await post(apiKey, body, idempotencyKey);
  }
  if (!attempt.ok) throw new EmailSendError(attempt.reason, attempt.status);
}
