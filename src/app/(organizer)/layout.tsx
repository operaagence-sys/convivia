import type { Metadata } from 'next';
import { AppShell } from '@/components/layout/app-shell';
import { SuspendedBanner } from '@/components/account/suspended-banner';
import { OrganizerBottomNav, ToastProvider } from '@/components/ui';
import { requireOrganizer } from '@/lib/auth/organizer-session';

// Face organisateur connectée (mobile-first) : jamais indexée.
export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * Layout des pages protégées. Un layout ne se rejoue pas à chaque navigation interne : chaque
 * page et chaque Server Action refont donc leur propre contrôle (`requireOrganizer`).
 */
export default async function OrganizerLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { suspended } = await requireOrganizer();
  return (
    <ToastProvider>
      <AppShell nav={<OrganizerBottomNav />} banner={suspended ? <SuspendedBanner /> : undefined}>
        {children}
      </AppShell>
    </ToastProvider>
  );
}
