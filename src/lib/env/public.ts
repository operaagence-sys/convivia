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
