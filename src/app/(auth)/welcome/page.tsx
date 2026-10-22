import { redirect } from 'next/navigation';
import { getActiveCountries } from '@/lib/auth/profile';
import { requireOrganizer } from '@/lib/auth/organizer-session';
import { WelcomeScreen } from './welcome-screen';

// Écran « Votre profil » (D44) : connecté, profil incomplet. Profil déjà rempli : tableau de bord.
export default async function WelcomePage() {
  const { profileComplete, suspended } = await requireOrganizer({ profile: 'any' });
  if (profileComplete) redirect('/dashboard');

  const countries = await getActiveCountries();
  return <WelcomeScreen countries={countries} suspended={suspended} />;
}
