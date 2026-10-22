import 'server-only';
import { randomInt } from 'node:crypto';

/**
 * Durée minimale d'une demande de code (D23): admin (rien d'envoyé), compte existant, nouveau
 * compte et refus répondent après le même délai. L'e-mail part dans `after()` (après la réponse):
 * sa durée n'influence plus la réponse, le plancher n'a donc plus qu'à masquer les écarts de la
 * base. 800 ms + 0 à 200 ms.
 */
export const MIN_CODE_REQUEST_MS = 800;
export const CODE_REQUEST_JITTER_MS = 200;

/**
 * Durée minimale d'une vérification: la création de session (createUser, generateLink, verifyOtp)
 * ne doit pas distinguer un code juste d'un code faux par la durée. 1 s + 0 à 300 ms.
 */
export const MIN_VERIFY_MS = 1000;
export const VERIFY_JITTER_MS = 300;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function waitUntil(startedAt: number, floor: number, jitter: number): Promise<void> {
  const target = floor + randomInt(0, jitter + 1);
  const remaining = target - (Date.now() - startedAt);
  if (remaining > 0) await sleep(remaining);
}

/** Attend ce qui manque pour que `startedAt` + durée plancher (+ aléa) soit atteint. */
export function waitForMinimumDuration(startedAt: number): Promise<void> {
  return waitUntil(startedAt, MIN_CODE_REQUEST_MS, CODE_REQUEST_JITTER_MS);
}

/** Idem pour `/verify`. */
export function waitForMinimumVerifyDuration(startedAt: number): Promise<void> {
  return waitUntil(startedAt, MIN_VERIFY_MS, VERIFY_JITTER_MS);
}
