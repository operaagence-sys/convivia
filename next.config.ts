import type { NextConfig } from 'next';
import {
  assertDistinctLoginSecrets,
  assertModeGuards,
  assertNoSecretPublicVariables,
  assertProductionRequiredEnv,
} from './src/lib/env/guards';

/**
 * Configuration Next.js. Proprietaire unique: devops-engineer (CLAUDE.md 7, TRD 1.2, 11.1).
 *
 * En-tetes de securite: voir `docs/06-trd.md` 4 (X-Robots-Tag sur /i/*), 12.2 (aucun traceur
 * sur /i/*). Le reste n'a pas de source documentaire precise; choix du devops-engineer, a
 * resserrer au fil des tranches (voir les commentaires ci-dessous).
 */

// Garde-fous de mode des le build et le demarrage (TRD 15): un deploiement Vercel mal configure
// echoue ici, avant meme `register()`. Sans variable (local, CI), valeurs par defaut: passe.
// Import relatif volontaire: guards.ts est pur (aucune dependance, pas de `server-only`).
assertModeGuards({
  vercelEnv: process.env.VERCEL_ENV || undefined,
  whatsappMode: process.env.WHATSAPP_MODE || 'simulate',
  fedapayEnv: process.env.FEDAPAY_ENV || 'sandbox',
  fedapaySecretKey: process.env.FEDAPAY_SECRET_KEY || undefined,
});
// Aucun secret dans une variable NEXT_PUBLIC_* (copiee dans le JavaScript public au build):
// liste blanche des noms + controle des valeurs. Fait echouer le build, sans afficher de valeur.
assertNoSecretPublicVariables(process.env);
// Production: variables indispensables presentes au build (Vercel les expose pendant le build).
assertProductionRequiredEnv(process.env.VERCEL_ENV || undefined, process.env);
// Les trois secrets de connexion doivent être différents (sans afficher de valeur).
assertDistinctLoginSecrets(process.env);

const isDev = process.env.NODE_ENV !== 'production';

// Sources externes autorisees hors /i/* (a resserrer quand l'integration reelle existe):
// - Supabase (API, Realtime, Storage) ; PostHog UE (vitrine) . Sentry: serveur seulement, aucune origine navigateur.
const SUPABASE_HTTP = 'https://*.supabase.co';
const SUPABASE_WS = 'wss://*.supabase.co';
const POSTHOG = 'https://eu.i.posthog.com https://eu-assets.i.posthog.com';

/**
 * CSP statique. `'unsafe-inline'` pour les scripts est le prix d'une page rendue sans nonce
 * (un nonce impose un rendu dynamique de chaque page et supprime le cache; a reevaluer).
 * `'wasm-unsafe-eval'`: necessaire a zxing-wasm (lecture des QR sur iOS, TRD 10); pourra etre
 * limite aux routes de scan quand elles existeront.
 */
const appCsp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://eu-assets.i.posthog.com${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${SUPABASE_HTTP}`,
  "font-src 'self'",
  `connect-src 'self' ${SUPABASE_HTTP} ${SUPABASE_WS} ${POSTHOG}${isDev ? ' ws://localhost:*' : ''}`,
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

/** CSP de /i/*: aucune origine tierce, pas d'appel hors du site (CLAUDE.md 5, TRD D18). */
const invitationCsp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${SUPABASE_HTTP}`,
  "font-src 'self'",
  `connect-src 'self'${isDev ? ' ws://localhost:*' : ''}`,
  "worker-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const commonHeaders = [
  // Vercel ajoute deja HSTS sur ses domaines; on le pose aussi pour un domaine personnalise.
  // Pas de `preload` tant que le domaine definitif n'est pas choisi.
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  // camera=(self): ecran de scan (TRD 6.6). Le reste est ferme.
  {
    key: 'Permissions-Policy',
    value: 'camera=(self), microphone=(), geolocation=(), payment=(), usb=()',
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  async headers() {
    return [
      {
        // Tout sauf /i/*
        source: '/:path((?!i/).*)',
        headers: [
          ...commonHeaders,
          { key: 'Content-Security-Policy', value: appCsp },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
      {
        // Pages invitees: personnelles, jamais indexees, aucun tiers (TRD 4, 12.2).
        // Referrer-Policy no-referrer: le jeton est dans l'URL; il ne doit fuiter vers aucun site.
        source: '/i/:path*',
        headers: [
          ...commonHeaders,
          { key: 'Content-Security-Policy', value: invitationCsp },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        ],
      },
    ];
  },
};

/**
 * Sentry: le televersement des source maps n'est actif que si un jeton est fourni (CI/Vercel).
 * Sans jeton, la configuration reste celle de Next.js, sans plugin. Le SDK navigateur n'est
 * volontairement pas installe (`instrumentation-client.ts` absent): jamais sur /i/*.
 */
const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN;

export default async function config(): Promise<NextConfig> {
  if (!sentryAuthToken) return nextConfig;
  // Import dynamique: le plugin Sentry (lourd) n'est charge que si un jeton est fourni.
  const { withSentryConfig } = await import('@sentry/nextjs/config');
  return withSentryConfig(nextConfig, {
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
    authToken: sentryAuthToken,
    silent: true,
    telemetry: false,
    sourcemaps: { deleteSourcemapsAfterUpload: true },
    widenClientFileUpload: false,
  });
}
