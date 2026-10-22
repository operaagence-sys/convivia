import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getPublicSupabaseConfig } from '@/lib/env/public';
import { getSessionCookieOptions } from './cookie-options';
import type { Database } from '@/types/database-overrides';

/**
 * Client Supabase serveur (Server Components, Server Actions, Route Handlers), lié à la
 * session de l'utilisateur par les cookies. Clé anonyme: la RLS s'applique.
 * Ne pas l'utiliser pour `/i/*` (pages invités sans session): voir `createAnonServerClient`.
 */
export async function createClient() {
  // `cookies()` d'abord : la page devient dynamique (jamais prérendue au build, sans variables).
  const cookieStore = await cookies();
  const { url, anonKey } = getPublicSupabaseConfig();
  return createServerClient<Database>(url, anonKey, {
    cookieOptions: getSessionCookieOptions(),
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
          // Appelé depuis un Server Component: l'écriture de cookies y est impossible.
          // Le proxy (src/proxy.ts) rafraîchit la session, on peut ignorer.
        }
      },
    },
  });
}
