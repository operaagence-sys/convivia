'use server';

import { requestLoginCode } from '@/lib/auth/request-code';
import { setPendingEmail } from '@/lib/auth/pending-email';
import { parseEmail } from '@/lib/auth/identifier';
import type { CodeRequestResult } from '@/lib/auth/types';

/**
 * Demande d'un code de connexion. Même réponse que le compte existe, n'existe pas ou soit un
 * compte admin (D23). L'e-mail est gardé pour `/verify` dans un cookie httpOnly de 10 min.
 */
export async function requestCodeAction(email: string): Promise<CodeRequestResult> {
  const result = await requestLoginCode(email);
  if (result.ok) {
    const normalized = parseEmail(email);
    if (normalized) await setPendingEmail(normalized);
  }
  return result;
}
