import Link from 'next/link';
import { StatePage, stateActionClass } from '@/components/state/state-page';
import { messages } from '@/content/messages.fr';

// Page provisoire (tranche 1). Le noindex vient du layout du groupe de routes.
export default function AdminHomePage() {
  const m = messages.placeholder;
  return (
    <StatePage title={m.admin.title} description={m.admin.description}>
      <Link href="/" className={stateActionClass}>
        {m.home}
      </Link>
    </StatePage>
  );
}
