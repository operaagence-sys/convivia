import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import { getSiteUrl } from '@/lib/env/public';

// Police unique (04 § 3), auto-hébergée par next/font au build; alimente --font-sans (tokens.css).
const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-plus-jakarta',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: 'Convivia',
  description: 'Invitations digitales pour vos événements.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

// Layout racine volontairement minimal: ni fournisseur, ni traceur, ni script tiers.
// Il est partage avec /i/* (budget < 1 Mo, aucun traceur): ne rien y ajouter de tiers.
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" className={plusJakartaSans.variable}>
      <body>{children}</body>
    </html>
  );
}
