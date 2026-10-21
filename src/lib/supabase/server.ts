import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getPublicSupabaseConfig } from '@/lib/env/public';
import type { Database } from '@/types/database';

/**
 * Client Supabase serveur (Server Components, Server Actions, Route Handlers), lié à la
 * session de l'utilisateur par les cookies. Clé anonyme: la RLS s'applique.
 * Ne pas l'utiliser pour `/i/*` (pages invités sans session): voir `createAnonServerClient`.
 */
export async function createClient() {
  const { url, anonKey } = getPublicSupabaseConfig();
  const cookieStore = await cookies();
  return createServerClient<Database>(url, anonKey, {
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
