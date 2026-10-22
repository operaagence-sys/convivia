import { redirect } from 'next/navigation';
import { loadOrganizerAccess } from '@/lib/auth/organizer-session';
import { getPendingEmail } from '@/lib/auth/pending-email';
import { LoginScreen } from './login-screen';

// Dépend des cookies (session, e-mail en cours) : rendu à chaque requête.
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ change?: string | string[] }>;
}) {
  // Déjà connecté (compte organisateur) : directement au tableau de bord.
  const access = await loadOrganizerAccess();
  if (access.kind === 'organizer') redirect('/dashboard');

  // On ne pré-remplit l'adresse en cours (cookie 10 min) QUE si le visiteur vient de
  // « Changer d'adresse e-mail » (`?change=1`, sans adresse dans l'URL) ; sinon, champ vide.
  const { change } = await searchParams;
  const defaultEmail = change === '1' ? await getPendingEmail() : undefined;
  return <LoginScreen defaultEmail={defaultEmail} />;
}
