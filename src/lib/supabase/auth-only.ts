import 'server-only';
import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { requireServerEnv } from '@/lib/env/server';
import { getSessionCookieOptions } from './cookie-options';
import type { Database } from '@/types/database-overrides';

type AuthApi = SupabaseClient<Database>['auth'];

/**
 * Seule surface exposée (audit F1): `auth.verifyOtp` et `auth.signOut`. Ni `.from()`, ni `.rpc()`,
 * ni stockage, ni `auth.admin` (qui, avec la clé secrète, créerait ou supprimerait des comptes).
 */
export type AuthOnlyClient = {
  readonly auth: {
    readonly verifyOtp: AuthApi['verifyOtp'];
    readonly signOut: AuthApi['signOut'];
  };
};

/** En-tête qui transmet l'IP du visiteur à Supabase Auth (« IP address forwarding »). */
export const FORWARDED_IP_HEADER = 'sb-forwarded-for';

/**
 * Client réservé aux appels Auth du serveur (`verifyOtp` après `login_code_verify`, `signOut`).
 *
 * Supabase n'accepte `sb-forwarded-for` (IP réelle du visiteur, sinon toutes les requêtes Auth
 * semblent venir des serveurs Vercel et les limites par IP de Supabase frappent tout le monde)
 * que si la requête porte une clé secrète `sb_secret_…`. Cette clé contourne la RLS: le client
 * n'expose donc que `auth` (le type ET l'objet renvoyé), de sorte qu'aucun code ne puisse
 * l'utiliser pour lire ou écrire des données. Il reste lié aux cookies de session: `verifyOtp`
 * pose la session de l'utilisateur (cookies `httpOnly`, 30 jours) comme le client habituel.
 *
 * `ip` vaut `undefined` quand l'IP n'est pas fiable (hors Vercel): l'en-tête est alors omis.
 */
export async function createAuthOnlyClient(ip: string | undefined): Promise<AuthOnlyClient> {
  // `cookies()` d'abord: la page devient dynamique (jamais prérendue au build, sans variables).
  const cookieStore = await cookies();
  const env = requireServerEnv('NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SECRET_KEY');
  const client = createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SECRET_KEY,
    {
      cookieOptions: getSessionCookieOptions(),
      global: ip ? { headers: { [FORWARDED_IP_HEADER]: ip } } : undefined,
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Appelé hors d'une Server Action ou d'une route: l'écriture de cookies y est impossible.
          }
        },
      },
    },
  );
  const auth = client.auth;
  return {
    auth: {
      verifyOtp: (params) => auth.verifyOtp(params),
      signOut: (options) => auth.signOut(options),
    },
  };
}
