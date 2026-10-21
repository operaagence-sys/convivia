/**
 * Garde-fou de mode pour les Edge Functions Supabase (whatsapp-dispatcher, send-login-code).
 *
 * Les Edge Functions n'ont pas `VERCEL_ENV`. Le garde compare donc l'identifiant du projet
 * Supabase (déduit de `SUPABASE_URL`, fournie par la plateforme et non modifiable depuis le
 * code) à celui de la production. Décision du porteur du projet (10-progress.md, C3).
 *
 * Fichier pur (aucun import, aucune API Deno): testé par Vitest (tests/unit).
 */

/**
 * Identifiant du projet Supabase de PRODUCTION. Vide tant que le projet n'existe pas:
 * à renseigner en tranche 16 par le porteur du projet, avec le devops-engineer.
 * Tant qu'il est vide, le mode `live` est refusé partout.
 */
export const PRODUCTION_SUPABASE_PROJECT_ID = '';

export type EdgeWhatsappMode = 'simulate' | 'test' | 'live';

export class EdgeModeGuardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EdgeModeGuardError';
  }
}

/** `https://<ref>.supabase.co` -> `<ref>`; `undefined` si l'URL n'a pas cette forme. */
export function projectIdFromSupabaseUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const host = new URL(url).hostname;
    const match = /^([a-z0-9]{20})\.supabase\.(co|in)$/.exec(host);
    return match?.[1];
  } catch {
    return undefined;
  }
}

export function isProductionProject(
  supabaseUrl: string | undefined,
  productionProjectId: string = PRODUCTION_SUPABASE_PROJECT_ID,
): boolean {
  if (productionProjectId === '') return false;
  return projectIdFromSupabaseUrl(supabaseUrl) === productionProjectId;
}

/**
 * Valide le mode WhatsApp demandé: `live` n'est accepté que sur le projet de production.
 * Toute valeur inconnue est refusée (échec fermé). Absent = `simulate`.
 */
export function resolveEdgeWhatsappMode(params: {
  mode: string | undefined;
  supabaseUrl: string | undefined;
  productionProjectId?: string;
}): EdgeWhatsappMode {
  const mode = params.mode && params.mode !== '' ? params.mode : 'simulate';
  if (mode !== 'simulate' && mode !== 'test' && mode !== 'live') {
    throw new EdgeModeGuardError('Mode WhatsApp inconnu.');
  }
  if (mode === 'live' && !isProductionProject(params.supabaseUrl, params.productionProjectId)) {
    throw new EdgeModeGuardError(
      "Mode WhatsApp live refusé: ce projet Supabase n'est pas celui de la production.",
    );
  }
  return mode;
}
