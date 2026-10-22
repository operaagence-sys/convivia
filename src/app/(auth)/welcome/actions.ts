'use server';

import { requireOrganizer } from '@/lib/auth/organizer-session';
import { saveOrganizerProfile } from '@/lib/auth/profile';
import type { ProfileSaveResult } from '@/lib/auth/types';

/** Premier enregistrement du profil (D44). L'identité vient de la session, jamais du navigateur. */
export async function saveProfileAction(input: {
  name: string;
  city: string;
  country: string;
}): Promise<ProfileSaveResult> {
  const context = await requireOrganizer({ profile: 'any', fresh: true });
  return saveOrganizerProfile(context, input);
}
