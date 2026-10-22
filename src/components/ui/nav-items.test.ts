import { describe, expect, it } from 'vitest';
import { messages } from '@/content/messages.fr';
import { eventNavItems, hostNavItems, organizerNavItems } from './nav-items';

describe('nav-items', () => {
  it('les libellés viennent de messages.nav', () => {
    expect(organizerNavItems.map((item) => item.label)).toEqual([
      messages.nav.organizer.events,
      messages.nav.organizer.create,
      messages.nav.organizer.account,
    ]);
    expect(eventNavItems('e1').map((item) => item.label)).toEqual([
      messages.nav.event.overview,
      messages.nav.event.guests,
      messages.nav.event.send,
      messages.nav.event.rsvp,
    ]);
    expect(hostNavItems('e1').map((item) => item.label)).toEqual([
      messages.nav.host.scan,
      messages.nav.host.arrivals,
    ]);
  });
});
