import { Spinner } from '@/components/ui/spinner';
import { messages } from '@/content/messages.fr';

export default function Loading() {
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <Spinner label={messages.loading.label} className="size-8 text-accent-600" />
    </div>
  );
}
