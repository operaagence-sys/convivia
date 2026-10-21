import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { getPublicSupabaseConfig } from '@/lib/env/public';
import type { Database } from '@/types/database';

/** Chemins sans session ni cookie d'authentification (pages invités). */
export function isSessionExempt(pathname: string): boolean {
  return pathname === '/i' || pathname.startsWith('/i/');
}

/** Cookie de session Supabase (`sb-<ref>-auth-token`, éventuellement découpé en `.0`, `.1`). */
function hasAuthCookie(request: NextRequest): boolean {
  return request.cookies.getAll().some(({ name }) => /^sb-.+-auth-token(\.\d+)?$/.test(name));
}

/**
 * Rafraîchit la session Supabase (jetons expirés) et renvoie les cookies mis à jour.
 * Aucune route n'est protégée ici (la connexion arrive en tranche 2).
 * - `/i/*`: rien n'est lu ni écrit.
 * - Visiteur sans cookie de session: aucun appel réseau.
 * - Variables publiques absentes alors qu'un cookie de session existe: erreur de configuration
 *   levée (un échec net vaut mieux qu'une session non rafraîchie en silence).
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });

  if (isSessionExempt(request.nextUrl.pathname) || !hasAuthCookie(request)) return response;

  const config = getPublicSupabaseConfig();

  const supabase = createServerClient<Database>(config.url, config.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        // Empêche un cache (CDN) de servir ces cookies à un autre visiteur.
        for (const [key, value] of Object.entries(headers ?? {})) response.headers.set(key, value);
      },
    },
  });

  // getUser() valide le jeton auprès de Supabase Auth (getSession() ne le vérifie pas).
  await supabase.auth.getUser();
  return response;
}
