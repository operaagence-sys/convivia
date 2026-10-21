import { getServerEnv } from './server';

/**
 * Validation de l'environnement serveur au démarrage (appelée par `register()` de
 * `instrumentation.ts`, aussi exécuté pendant `next build`).
 *
 * Même comportement partout: les garde-fous de mode s'appliquent dès le démarrage et non au
 * premier usage. Un déploiement Vercel mal configuré (WhatsApp live en preview, ou
 * simulate/test en production) échoue net. Sans variable (local, CI), tout est optionnel et la
 * validation passe avec les valeurs par défaut (simulate, sandbox).
 * Les messages d'erreur ne contiennent jamais de valeur de variable.
 */
export function assertServerEnvAtStartup(): void {
  getServerEnv();
}
