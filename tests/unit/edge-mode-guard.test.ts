import { describe, expect, it } from 'vitest';
import {
  EdgeModeGuardError,
  isProductionProject,
  PRODUCTION_SUPABASE_PROJECT_ID,
  projectIdFromSupabaseUrl,
  resolveEdgeWhatsappMode,
} from '../../supabase/functions/_shared/mode-guard';

// Identifiants fictifs de 20 caractères (format des références de projet Supabase).
const PROD_ID = 'abcdefghijklmnopqrst';
const STAGING_ID = 'zyxwvutsrqponmlkjihg';
const prodUrl = `https://${PROD_ID}.supabase.co`;
const stagingUrl = `https://${STAGING_ID}.supabase.co`;

describe('mode-guard (Edge Functions)', () => {
  it('la constante de production est vide tant que la tranche 16 n’a pas eu lieu', () => {
    expect(PRODUCTION_SUPABASE_PROJECT_ID).toBe('');
  });

  it('extrait l’identifiant du projet depuis SUPABASE_URL', () => {
    expect(projectIdFromSupabaseUrl(prodUrl)).toBe(PROD_ID);
    expect(projectIdFromSupabaseUrl('http://127.0.0.1:54321')).toBeUndefined();
    expect(projectIdFromSupabaseUrl('pas une url')).toBeUndefined();
    expect(projectIdFromSupabaseUrl(undefined)).toBeUndefined();
    expect(projectIdFromSupabaseUrl(`https://evil.example/${PROD_ID}.supabase.co`)).toBeUndefined();
  });

  it('refuse live tant que l’identifiant de production est vide (valeur du dépôt)', () => {
    expect(() => resolveEdgeWhatsappMode({ mode: 'live', supabaseUrl: prodUrl })).toThrow(
      EdgeModeGuardError,
    );
    expect(isProductionProject(prodUrl)).toBe(false);
  });

  it('refuse live sur le staging et en local', () => {
    for (const supabaseUrl of [stagingUrl, 'http://127.0.0.1:54321', undefined]) {
      expect(() =>
        resolveEdgeWhatsappMode({ mode: 'live', supabaseUrl, productionProjectId: PROD_ID }),
      ).toThrow(EdgeModeGuardError);
    }
  });

  it('accepte live sur le projet de production', () => {
    expect(
      resolveEdgeWhatsappMode({ mode: 'live', supabaseUrl: prodUrl, productionProjectId: PROD_ID }),
    ).toBe('live');
  });

  it('simulate par défaut, test accepté, valeur inconnue refusée', () => {
    expect(resolveEdgeWhatsappMode({ mode: undefined, supabaseUrl: stagingUrl })).toBe('simulate');
    expect(resolveEdgeWhatsappMode({ mode: '', supabaseUrl: stagingUrl })).toBe('simulate');
    expect(resolveEdgeWhatsappMode({ mode: 'test', supabaseUrl: stagingUrl })).toBe('test');
    expect(() => resolveEdgeWhatsappMode({ mode: 'prod', supabaseUrl: prodUrl })).toThrow(
      EdgeModeGuardError,
    );
  });
});
