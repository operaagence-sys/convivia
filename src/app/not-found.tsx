import Link from 'next/link';
import { StatePage, stateActionClass } from '@/components/state/state-page';
import { messages } from '@/content/messages.fr';

export default function NotFound() {
  const m = messages.notFound;
  return (
    <StatePage title={m.title} description={m.description}>
      <Link href="/" aria-label={m.actionLabel} className={stateActionClass}>
        {m.action}
      </Link>
    </StatePage>
  );
}
