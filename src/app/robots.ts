import type { MetadataRoute } from 'next';

// Les pages invitees ne sont jamais indexees (TRD 4). L'espace organisateur et l'accueil
// non plus: a ouvrir pour la vitrine seulement (tranche 13).
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', disallow: ['/i/', '/admin', '/scan', '/api/'] }],
  };
}
