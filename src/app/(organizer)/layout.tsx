import type { Metadata } from 'next';

// Face organisateur (mobile-first). Espace connecté: jamais indexé.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function OrganizerLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
