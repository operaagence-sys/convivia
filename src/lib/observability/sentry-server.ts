import * as Sentry from '@sentry/nextjs';
import { scrubBreadcrumb, scrubEvent } from './scrub';

/**
 * Initialisation de Sentry côté SERVEUR uniquement (nodejs et edge de Next.js).
 * Aucun SDK navigateur n'est installé: ni `instrumentation-client.ts`, ni Session Replay
 * (CLAUDE.md 5: aucun traceur sur /i/*). Appelé seulement si `SENTRY_DSN` est défini.
 */
export function initSentryServer(dsn: string, environment: string): void {
  Sentry.init({
    dsn,
    environment,
    // Sentry 11: tout est collecté par défaut. On coupe tout ce qui peut porter une donnée
    // personnelle (utilisateur, cookies, en-têtes, corps, paramètres d'URL, variables locales,
    // requêtes SQL). `scrubEvent` reste la seconde barrière.
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      databaseQueryData: false,
      queues: false,
      stackFrameVariables: false,
      genAI: { inputs: false, outputs: false },
    },
    // Offre gratuite: erreurs seulement, pas de traces de performance.
    tracesSampleRate: 0,
    maxBreadcrumbs: 20,
    beforeSend: (event) => scrubEvent(event),
    beforeBreadcrumb: (breadcrumb) => scrubBreadcrumb(breadcrumb),
  });
}
