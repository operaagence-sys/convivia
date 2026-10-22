'use server';

import { clearPendingEmail, getPendingEmail } from '@/lib/auth/pending-email';
import { requestLoginCode } from '@/lib/auth/request-code';
import type { ResendResult, VerifyResult } from '@/lib/auth/types';
import { verifyLoginCode } from '@/lib/auth/verify-code';

/** Vérifie le code saisi pour l'e-mail du cookie (jamais un e-mail venu du navigateur). */
export async function verifyCodeAction(code: string): Promise<VerifyResult> {
  const email = await getPendingEmail();
  const result = await verifyLoginCode(email, code);
  if (result.ok) await clearPendingEmail();
  return result;
}

/** Renvoie un code : même chemin que `/login` (plafond, blocage, compte admin). */
export async function resendCodeAction(): Promise<ResendResult> {
  const email = await getPendingEmail();
  if (!email) return { ok: false, error: { kind: 'missingEmail' } };
  return requestLoginCode(email);
}
