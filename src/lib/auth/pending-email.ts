import 'server-only';
import { cookies } from 'next/headers';
import { isHttpsDeployment } from '@/lib/env/public';
import { PENDING_EMAIL_COOKIE, PENDING_EMAIL_TTL_SECONDS } from './constants';
import { parseEmail } from './identifier';

/**
 * Seuls chemins qui lisent ou reçoivent le cookie (les Server Actions sont appelées depuis ces
 * pages). Un cookie n'ayant qu'un `path`, on en pose un par chemin: il n'est ainsi jamais envoyé
 * sur `/i/*` (pages invités) ni ailleurs.
 */
export const PENDING_EMAIL_PATHS = ['/login', '/verify'] as const;

/**
 * Cookie de l'e-mail en cours de connexion : `httpOnly` (illisible par le JavaScript de la page),
 * `sameSite=lax`, 10 min, `secure` dès que le site est servi en HTTPS (préproduction et
 * production ; seul `http://localhost` en développement l'omet), limité à `/login` et `/verify`.
 */
export async function setPendingEmail(email: string): Promise<void> {
  const store = await cookies();
  for (const path of PENDING_EMAIL_PATHS) {
    store.set(PENDING_EMAIL_COOKIE, email, {
      httpOnly: true,
      secure: isHttpsDeployment(),
      sameSite: 'lax',
      path,
      maxAge: PENDING_EMAIL_TTL_SECONDS,
    });
  }
}

/** E-mail en cours de connexion, revalidé (un cookie falsifié ne passe pas le format). */
export async function getPendingEmail(): Promise<string | undefined> {
  const store = await cookies();
  const raw = store.get(PENDING_EMAIL_COOKIE)?.value;
  return parseEmail(raw) ?? undefined;
}

export async function clearPendingEmail(): Promise<void> {
  const store = await cookies();
  for (const path of PENDING_EMAIL_PATHS) store.delete({ name: PENDING_EMAIL_COOKIE, path });
}
