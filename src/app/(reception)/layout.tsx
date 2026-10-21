import type { Metadata } from 'next';

// Face équipe d'accueil (/scan, sans compte). Jamais indexée.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function ReceptionLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
