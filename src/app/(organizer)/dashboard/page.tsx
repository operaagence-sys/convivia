import { messages } from '@/content/messages.fr';
import { requireOrganizer } from '@/lib/auth/organizer-session';

// Page provisoire jusqu'à la tranche 3 (aucun événement n'existe encore).
export default async function DashboardPage() {
  await requireOrganizer();
  const m = messages.placeholder.dashboard;
  return (
    <section className="flex flex-col gap-2">
      <h1 className="text-h1">{m.title}</h1>
      <p className="text-small text-text-secondary">{m.description}</p>
    </section>
  );
}
