import { CalendarPlus } from 'lucide-react';
import { messages } from '@/content/messages.fr';
import { ButtonLink } from '@/components/ui';

const text = messages.createSoon;

/** Page provisoire de « Créer » jusqu'à la tranche 3 (D58) : message sobre + retour à la liste. */
export function CreateSoon({ eventsHref = '/dashboard' }: { eventsHref?: string }) {
  return (
    <section className="flex flex-col items-center gap-3 rounded-lg border border-border-subtle bg-surface px-6 py-12 text-center">
      <span className="inline-flex size-12 items-center justify-center rounded-full bg-accent-100 text-accent-700">
        <CalendarPlus aria-hidden className="size-6" />
      </span>
      <h1 className="text-h2">{text.title}</h1>
      <p className="max-w-sm text-small text-text-secondary">{text.description}</p>
      <div className="mt-2">
        <ButtonLink href={eventsHref}>{text.action}</ButtonLink>
      </div>
    </section>
  );
}
