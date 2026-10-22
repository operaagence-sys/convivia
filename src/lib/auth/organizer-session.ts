import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database-overrides';

/** Colonnes lisibles de `organizers` (`select *` est refusé par la base). */
const ORGANIZER_COLUMNS =
  'id, full_name, email, country_code, city, status, suspended_at, created_at, updated_at';

export type OrganizerRow = Pick<
  Database['public']['Tables']['organizers']['Row'],
  | 'id'
  | 'full_name'
  | 'email'
  | 'country_code'
  | 'city'
  | 'status'
  | 'suspended_at'
  | 'created_at'
  | 'updated_at'
>;

export type OrganizerContext = {
  /** Client lié à la session de l'utilisateur (la RLS s'applique). */
  supabase: SupabaseClient<Database>;
  user: User;
  organizer: OrganizerRow;
  profileComplete: boolean;
  suspended: boolean;
};

export type OrganizerAccess =
  | { kind: 'anonymous' }
  /** Session valide mais aucune ligne `organizers` (compte admin, ou jamais passé par /verify). */
  | { kind: 'not_organizer' }
  | ({ kind: 'organizer' } & OrganizerContext);

export function isProfileComplete(organizer: OrganizerRow): boolean {
  return Boolean(organizer.full_name?.trim() && organizer.city?.trim() && organizer.country_code);
}

/**
 * Lit la session ET la ligne organisateur. `getUser()` valide le jeton auprès de Supabase Auth
 * (jamais `getSession()` seul : il ne vérifie pas la signature). Aucune écriture, aucune création
 * de ligne ici : seule `ensure_organizer` (après un code juste) en crée une.
 */
export async function loadOrganizerAccess(): Promise<OrganizerAccess> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { kind: 'anonymous' };

  const { data: organizer, error: organizerError } = await supabase
    .from('organizers')
    .select(ORGANIZER_COLUMNS)
    .eq('id', data.user.id)
    .maybeSingle();
  if (organizerError) {
    console.error('[auth] lecture du profil organisateur impossible', {
      code: organizerError.code,
    });
    return { kind: 'not_organizer' };
  }
  if (!organizer) return { kind: 'not_organizer' };

  return {
    kind: 'organizer',
    supabase,
    user: data.user,
    organizer,
    profileComplete: isProfileComplete(organizer),
    suspended: organizer.status === 'suspended',
  };
}

/** Version mémorisée pour la durée d'un rendu (layout + page = une seule vérification). */
const loadOrganizerAccessCached = cache(loadOrganizerAccess);

type RequireOptions = {
  /** `any` : l'écran profil lui-même (D44). Défaut `complete` : profil rempli exigé. */
  profile?: 'complete' | 'any';
  /** Server Actions : pas de mémoïsation (l'état doit être frais). */
  fresh?: boolean;
};

/**
 * Contrôle d'accès des pages protégées ET de chaque Server Action (le proxy ne protège rien).
 * Non connecté ou sans compte organisateur : `/login`. Profil incomplet : `/welcome` (D44).
 */
export async function requireOrganizer(options: RequireOptions = {}): Promise<OrganizerContext> {
  const { profile = 'complete', fresh = false } = options;
  const access = await (fresh ? loadOrganizerAccess() : loadOrganizerAccessCached());
  if (access.kind !== 'organizer') redirect('/login');
  if (profile === 'complete' && !access.profileComplete) redirect('/welcome');
  return access;
}
