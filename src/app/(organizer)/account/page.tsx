import { messages } from '@/content/messages.fr';
import { requireOrganizer } from '@/lib/auth/organizer-session';
import { getActiveCountries } from '@/lib/auth/profile';
import { AccountScreen } from './account-screen';

export default async function AccountPage() {
  const { organizer, suspended } = await requireOrganizer();
  const countries = await getActiveCountries();

  return (
    <>
      <h1 className="text-h1">{messages.account.title}</h1>
      <AccountScreen
        email={organizer.email}
        initialValues={{
          name: organizer.full_name ?? '',
          city: organizer.city ?? '',
          country: organizer.country_code ?? '',
        }}
        countries={countries}
        suspended={suspended}
      />
    </>
  );
}
