import 'server-only';
import { z } from 'zod';
import { messages } from '@/content/messages.fr';
import { createClient } from '@/lib/supabase/server';
import { CITY_MAX, NAME_MAX } from './constants';
import type { OrganizerContext } from './organizer-session';
import type { ProfileSaveResult } from './types';

/**
 * Texte libre du profil (D55) : pas de caractère de contrôle (retour à la ligne, tabulation),
 * espaces multiples réduits, au moins une lettre, 2 caractères au moins. La longueur maximale
 * est vérifiée à part pour renvoyer une erreur précise.
 */
function freeText(max: number) {
  return z
    .string()
    .refine((value) => !/\p{Cc}/u.test(value), 'control')
    .transform((value) => value.replace(/\s+/g, ' ').trim())
    .refine((value) => value.length <= max, 'too_long')
    .refine((value) => value.length >= 2 && /\p{L}/u.test(value), 'invalid');
}

const profileSchema = z.object({
  name: freeText(NAME_MAX),
  city: freeText(CITY_MAX),
  country: z.string().regex(/^[A-Z]{2}$/),
});

export type ProfileInput = z.infer<typeof profileSchema>;

function firstIssue(error: z.ZodError, field: 'name' | 'city' | 'country'): string | undefined {
  return error.issues.find((issue) => issue.path[0] === field)?.message;
}

/** Valide le profil côté serveur (en plus du navigateur). */
export function parseProfile(
  input: unknown,
):
  | { ok: true; value: ProfileInput }
  | { ok: false; error: Extract<ProfileSaveResult, { ok: false }>['error'] } {
  const result = profileSchema.safeParse(input);
  if (result.success) return { ok: true, value: result.data };
  const { error } = result;
  const name = firstIssue(error, 'name');
  if (name) return { ok: false, error: name === 'too_long' ? 'nameTooLong' : 'nameInvalid' };
  const city = firstIssue(error, 'city');
  if (city) return { ok: false, error: city === 'too_long' ? 'cityTooLong' : 'cityInvalid' };
  return { ok: false, error: 'countryInvalid' };
}

/**
 * Enregistre le profil avec le client DE L'UTILISATEUR (RLS : colonnes `full_name`, `city`,
 * `country_code`, compte actif). Compte suspendu : l'UPDATE ne touche aucune ligne et ne renvoie
 * aucune erreur, d'où le `.select('id')`.
 */
export async function saveOrganizerProfile(
  context: OrganizerContext,
  input: unknown,
): Promise<ProfileSaveResult> {
  const parsed = parseProfile(input);
  if (!parsed.ok) return parsed;

  const { data, error } = await context.supabase
    .from('organizers')
    .update({
      full_name: parsed.value.name,
      city: parsed.value.city,
      country_code: parsed.value.country,
    })
    .eq('id', context.user.id)
    .select('id');

  if (error) {
    console.error('[auth] enregistrement du profil refusé', { code: error.code });
    if (error.code === 'P0001') return { ok: false, error: 'countryInvalid' };
    if (error.code === '23514') {
      const field = /city/.test(error.message) ? 'cityInvalid' : 'nameInvalid';
      return { ok: false, error: field };
    }
    return { ok: false, error: 'saveFailed' };
  }
  if (!data || data.length === 0) {
    return { ok: false, error: context.suspended ? 'suspended' : 'saveFailed' };
  }
  return { ok: true };
}

export type CountryOption = { code: string; name: string };

/** Pays actifs (D53), lus dans `countries` ; le nom français vient des textes, sinon de la base. */
export async function getActiveCountries(): Promise<CountryOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('countries')
    .select('code, name')
    .eq('is_active', true)
    .order('name');
  if (error || !data) {
    console.error('[auth] lecture des pays impossible', { code: error?.code });
    return [];
  }
  const names: Record<string, string> = messages.auth.countries;
  return data.map((country) => ({ code: country.code, name: names[country.code] ?? country.name }));
}
