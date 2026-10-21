import type { captureRequestError } from '@sentry/nextjs';

/**
 * Point d'entrée Next.js (exécuté une fois au démarrage du serveur).
 * Sentry est INACTIF tant que `SENTRY_DSN` est vide (compte Sentry prévu avant la tranche 6).
 * Serveur seulement: aucun SDK navigateur, donc rien dans le bundle de /i/*.
 */
export async function register(): Promise<void> {
  // Garde-fous de mode dès le démarrage (runtimes nodejs et edge), avant tout le reste:
  // une configuration Vercel incohérente doit échouer net, pas au premier appel.
  const { assertServerEnvAtStartup } = await import('./lib/env/startup');
  assertServerEnvAtStartup();

  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  const { initSentryServer } = await import('./lib/observability/sentry-server');
  initSentryServer(dsn, process.env.VERCEL_ENV ?? 'development');
}

export async function onRequestError(
  ...args: Parameters<typeof captureRequestError>
): Promise<void> {
  if (!process.env.SENTRY_DSN) return;
  const Sentry = await import('@sentry/nextjs');
  Sentry.captureRequestError(...args);
}
