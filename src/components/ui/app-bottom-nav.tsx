'use client';

import { usePathname } from 'next/navigation';
import { messages } from '@/content/messages.fr';
import { BottomNav } from './bottom-nav';
import { eventNavItems, hostNavItems, organizerNavItems } from './nav-items';

/** Barre organisateur hors événement (liste, création, compte). */
export function OrganizerBottomNav() {
  return (
    <BottomNav
      items={organizerNavItems}
      pathname={usePathname()}
      ariaLabel={messages.nav.organizer.ariaLabel}
    />
  );
}

/** Barre organisateur dans un événement. */
export function EventBottomNav({ eventId }: { eventId: string }) {
  return (
    <BottomNav
      items={eventNavItems(eventId)}
      pathname={usePathname()}
      ariaLabel={messages.nav.event.ariaLabel}
    />
  );
}

/** Barre de l'équipe d'accueil (scanner / arrivées). */
export function HostBottomNav({ eventId }: { eventId: string }) {
  return (
    <BottomNav
      items={hostNavItems(eventId)}
      pathname={usePathname()}
      ariaLabel={messages.nav.host.ariaLabel}
    />
  );
}
