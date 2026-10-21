import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/session';

/**
 * Proxy Next.js 16 (ex-middleware): rafraîchit la session Supabase. Ne protège aucune route.
 * Exclusions du matcher: `/i/*` (pages invités: aucun cookie d'authentification), `/og/*`
 * (images d'aperçu), ressources statiques et fichiers à extension.
 */
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    '/((?!i(?:/|$)|_next/|og/|favicon\\.ico$|robots\\.txt$|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|woff2?|js|css|map|txt|xml|webmanifest)$).*)',
  ],
};
