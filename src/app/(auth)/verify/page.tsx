import { redirect } from 'next/navigation';
import { loadOrganizerAccess } from '@/lib/auth/organizer-session';
import { getPendingEmail } from '@/lib/auth/pending-email';
import { VerifyScreen } from './verify-screen';

export default async function VerifyPage() {
  const access = await loadOrganizerAccess();
  if (access.kind === 'organizer') redirect('/dashboard');

  // Sans cookie (périmé, supprimé) : l'écran propose de revenir à la connexion.
  const email = await getPendingEmail();
  return <VerifyScreen email={email} />;
}
