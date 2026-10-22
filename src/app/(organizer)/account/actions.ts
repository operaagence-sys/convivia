'use server';

import { revalidatePath } from 'next/cache';
import { clearPendingEmail } from '@/lib/auth/pending-email';
import { requireOrganizer } from '@/lib/auth/organizer-session';
import { saveOrganizerProfile } from '@/lib/auth/profile';
import { createClient } from '@/lib/supabase/server';
import type { ProfileSaveResult, SessionActionResult } from '@/lib/auth/types';

/** Modification du profil. Compte suspendu : refusé par la base, renvoyé comme `suspended`. */
export async function updateProfileAction(input: {
  name: string;
  city: string;
  country: string;
}): Promise<ProfileSaveResult> {
  const context = await requireOrganizer({ fresh: true });
  const result = await saveOrganizerProfile(context, input);
  if (result.ok) revalidatePath('/account');
  return result;
}

async function signOutWithScope(scope: 'local' | 'global'): Promise<SessionActionResult> {
  // Contrôle de connexion comme pour toute action (non connecté : /login).
  await requireOrganizer({ profile: 'any', fresh: true });
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut({ scope });
  if (error) {
    console.error('[auth] déconnexion refusée', { status: error.status, code: error.code });
    return { ok: false, error: 'signOutFailed' };
  }
  await clearPendingEmail();
  return { ok: true };
}

/** Déconnexion de cet appareil. */
export async function signOutAction(): Promise<SessionActionResult> {
  return signOutWithScope('local');
}

/** Déconnexion de TOUS les appareils (la confirmation est demandée par l'écran). */
export async function signOutAllAction(): Promise<SessionActionResult> {
  return signOutWithScope('global');
}
