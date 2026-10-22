import { useId } from 'react';
import { t } from '@/content/format';
import { messages } from '@/content/messages.fr';
import { InlineAlert } from '@/components/ui';

const text = messages.account.suspended;

/**
 * Bandeau « Compte suspendu » (lecture seule). Placé en haut de `/account` et de toute page où
 * les actions sont désactivées ; le parent désactive lui-même les actions.
 */
export function SuspendedBanner({ className }: { className?: string }) {
  const titleId = useId();
  return (
    <InlineAlert tone="warning" role="none" className={className}>
      <section aria-labelledby={titleId} className="flex flex-col gap-1">
        <h2 id={titleId} className="text-body font-semibold">
          {text.title}
        </h2>
        <p>{t(text.description, { email: text.email })}</p>
        <a
          href={`mailto:${text.email}`}
          className="inline-flex min-h-11 items-center font-semibold underline underline-offset-2"
        >
          {text.contactLabel}
        </a>
      </section>
    </InlineAlert>
  );
}
