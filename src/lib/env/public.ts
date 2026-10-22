/**
 * Variables publiques (`NEXT_PUBLIC_*`), utilisables aussi dans le navigateur.
 * Chaque variable est lue par son nom littéral (Next.js ne remplace que les accès littéraux).
 * Ne jamais ajouter ici un secret: voir `assertNoSecretPublicVariables`.
 */

const DEFAULT_SITE_URL = 'http://localhost:3000';

function asOrigin(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    return new URL(value).origin;
  } catch {
    return undefined;
  }
}

/** URL de base du site (liens absolus, Open Graph). */
export function getSiteUrl(): string {
  const configured = asOrigin(process.env.NEXT_PUBLIC_SITE_URL);
  if (configured) return configured;
  // Aperçus Vercel: l'adresse du déploiement.
  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl) return asOrigin(`https://${vercelUrl}`) ?? DEFAULT_SITE_URL;
  return DEFAULT_SITE_URL;
}

export function getPublicSupabaseConfig(): { url: string; anonKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      'Variable(s) manquante(s): NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY',
    );
  }
  return { url, anonKey };
}

/**
 * Vrai quand le site est servi en HTTPS: déploiements Vercel (preview, production) ou
 * `NEXT_PUBLIC_SITE_URL` en https. Seul `http://localhost` en développement échappe à la règle
 * (Safari refuse les cookies `Secure` en HTTP).
 */
export function isHttpsDeployment(): boolean {
  const vercelEnv = process.env.VERCEL_ENV;
  if (vercelEnv === 'production' || vercelEnv === 'preview') return true;
  return process.env.NEXT_PUBLIC_SITE_URL?.startsWith('https://') ?? false;
}

/** Vrai sur la plateforme Vercel (qui fixe `VERCEL=1`): seule source fiable de l'IP du visiteur. */
export function isOnVercel(): boolean {
  return Boolean(process.env.VERCEL);
}
