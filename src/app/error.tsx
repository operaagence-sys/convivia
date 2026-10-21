'use client';

import Link from 'next/link';
import { StatePage, stateActionClass } from '@/components/state/state-page';
import { messages } from '@/content/messages.fr';

// Aucune trace ni code d'erreur affiché (l'erreur n'est pas rendue).
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  const m = messages.error;
  return (
    <StatePage title={m.title} description={m.description}>
      <button
        type="button"
        onClick={() => reset()}
        aria-label={m.retryLabel}
        className={stateActionClass}
      >
        {m.retry}
      </button>
      <Link href="/" className={stateActionClass}>
        {m.home}
      </Link>
    </StatePage>
  );
}
