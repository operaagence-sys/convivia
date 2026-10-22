import { isHttpsDeployment } from '@/lib/env/public';

/**
 * Durée de vie des cookies de session Supabase : 30 jours (TRD § 7.4). Glissante : les cookies
 * sont réécrits avec cette durée à chaque rafraîchissement du jeton (proxy `src/proxy.ts`), donc
 * tant que l'organisateur revient au moins une fois par 30 jours, il reste connecté.
 * Sans cette option, `@supabase/ssr` garde 400 jours.
 */
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

/**
 * Options des cookies de session. `httpOnly` : aucun JavaScript de la page ne lit le jeton (il n'y
 * a plus de client Supabase navigateur : toute la session passe par le serveur). `sameSite=lax`
 * suffit au retour depuis un lien externe (WhatsApp) sans exposer le cookie aux requêtes
 * intersites. Pas de `domain` : cookie limité à l'hôte exact.
 */
export function getSessionCookieOptions() {
  return {
    maxAge: SESSION_MAX_AGE_SECONDS,
    httpOnly: true,
    secure: isHttpsDeployment(),
    sameSite: 'lax',
    path: '/',
  } as const;
}
