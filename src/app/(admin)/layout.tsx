import type { Metadata } from 'next';

// Administration (/admin, desktop, hors périmètre du frontend-developer). Jamais indexée.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
