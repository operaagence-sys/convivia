import { CreateSoon } from '@/components/account/create-soon';
import { requireOrganizer } from '@/lib/auth/organizer-session';

// Page provisoire de l'onglet « Créer » jusqu'à la tranche 3 (D58).
export default async function NewEventPage() {
  await requireOrganizer();
  return <CreateSoon />;
}
