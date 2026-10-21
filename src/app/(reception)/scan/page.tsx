import Link from 'next/link';
import { StatePage, stateActionClass } from '@/components/state/state-page';
import { messages } from '@/content/messages.fr';

// Page provisoire (tranche 1). Le noindex vient du layout du groupe de routes.
export default function ScanEntryPage() {
  const m = messages.placeholder;
  return (
    <StatePage title={m.scan.title} description={m.scan.description}>
      <Link href="/" className={stateActionClass}>
        {m.home}
      </Link>
    </StatePage>
  );
}
