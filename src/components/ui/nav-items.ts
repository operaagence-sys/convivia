import {
  CalendarDays,
  ClipboardCheck,
  CirclePlus,
  LayoutGrid,
  Radio,
  ScanLine,
  Send,
  UserRound,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { messages } from '@/content/messages.fr';

const nav = messages.nav;

export type NavItem = {
  href: string;
  /** Libellé court (≤ 10 caractères pour tenir à 4-5 onglets sur 320 px), issu de `messages.nav`. */
  label: string;
  icon: LucideIcon;
  /** `exact`: actif seulement sur cette adresse; `prefix`: actif aussi sur ses sous-pages. */
  match?: 'exact' | 'prefix';
};

/**
 * PROPOSITION d'onglets (à valider par le porteur du projet), déduite de docs/02-app-flow.md.
 *
 * Organisateur, hors événement (§ 1.5, 1.6, 1.5 « Paramètres du compte »): 3 onglets.
 * Le « + » au centre est l'action la plus fréquente d'un nouvel utilisateur (/events/new).
 */
export const organizerNavItems: readonly NavItem[] = [
  { href: '/dashboard', label: nav.organizer.events, icon: CalendarDays, match: 'prefix' },
  { href: '/events/new', label: nav.organizer.create, icon: CirclePlus, match: 'exact' },
  { href: '/account', label: nav.organizer.account, icon: UserRound, match: 'prefix' },
];

/**
 * Organisateur, dans un événement (§ 1.7): les 4 sections du quotidien. Les autres sections
 * (design, contenu, forfait, tables, accueil, après l'événement) restent accessibles par les
 * tuiles de la vue d'ensemble (04 § 11.1), pour ne pas dépasser 5 onglets.
 */
export function eventNavItems(eventId: string): readonly NavItem[] {
  const base = `/events/${eventId}`;
  return [
    { href: base, label: nav.event.overview, icon: LayoutGrid, match: 'exact' },
    { href: `${base}/guests`, label: nav.event.guests, icon: Users, match: 'prefix' },
    { href: `${base}/send`, label: nav.event.send, icon: Send, match: 'prefix' },
    { href: `${base}/rsvp`, label: nav.event.rsvp, icon: ClipboardCheck, match: 'prefix' },
  ];
}

/** Équipe d'accueil (§ 3.2, 3.3): scanner et arrivées en direct. Aucune autre page. */
export function hostNavItems(eventId: string): readonly NavItem[] {
  const base = `/scan/${eventId}`;
  return [
    { href: base, label: nav.host.scan, icon: ScanLine, match: 'exact' },
    { href: `${base}/live`, label: nav.host.arrivals, icon: Radio, match: 'exact' },
  ];
}

export function isNavItemActive(item: NavItem, pathname: string): boolean {
  if (item.match === 'prefix') {
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  }
  return pathname === item.href;
}
