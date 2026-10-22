import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { getPublicSupabaseConfig } from '@/lib/env/public';
import { getSessionCookieOptions } from './cookie-options';
import type { Database } from '@/types/database-overrides';

/** Chemins sans session ni cookie d'authentification (pages invités). */
export function isSessionExempt(pathname: string): boolean {
  return pathname === '/i' || pathname.startsWith('/i/');
}

/** Cookie de session Supabase (`sb-<ref>-auth-token`, éventuellement découpé en `.0`, `.1`). */
function hasAuthCookie(request: NextRequest): boolean {
  return request.cookies.getAll().some(({ name }) => /^sb-.+-auth-token(\.\d+)?$/.test(name));
}

/**
 * Refus du Custom Access Token Hook: HTTP 403 de code `access_denied`. Selon la version de
 * Supabase Auth, le code peut manquer: le refus est alors reconnu par le statut 403 ET le message
 * (audit F4). Un 403 d'une autre cause ne ferme pas la session.
 */
export function isAccessDenied(
  error: { status?: number; code?: string; message?: string } | null,
): boolean {
  if (!error) return false;
  if (error.code === 'access_denied') return true;
  return error.status === 403 && /access_denied/i.test(error.message ?? '');
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
    cookieOptions: getSessionCookieOptions(),
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
  const { error } = await supabase.auth.getUser();

  // Le hook d'accès refuse le rafraîchissement (403 `access_denied`: compte admin, ou compte qui
  // n'a plus le droit d'obtenir un jeton): session fermée ici (cookies effacés) et retour à /login.
  if (isAccessDenied(error) && request.nextUrl.pathname !== '/login') {
    await supabase.auth.signOut({ scope: 'local' });
    const redirect = NextResponse.redirect(new URL('/login', request.url));
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    // Ceinture et bretelles: les cookies de session de la requête sont expirés quoi qu'il arrive.
    for (const { name } of request.cookies.getAll()) {
      if (/^sb-.+-auth-token(\.\d+)?$/.test(name)) {
        redirect.cookies.set(name, '', { ...getSessionCookieOptions(), maxAge: 0 });
      }
    }
    for (const [key, value] of response.headers) {
      if (key.toLowerCase() === 'cache-control') redirect.headers.set(key, value);
    }
    return redirect;
  }
  return response;
}
