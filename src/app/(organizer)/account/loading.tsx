import { Spinner } from '@/components/ui';
import { messages } from '@/content/messages.fr';

export default function AccountLoading() {
  return (
    <div className="flex justify-center py-12">
      <Spinner label={messages.account.loading} />
    </div>
  );
}
