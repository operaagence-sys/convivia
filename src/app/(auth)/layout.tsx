import type { Metadata } from 'next';
import { AuthScreenLayout } from '@/components/layout/auth-screen-layout';

// Écrans publics de connexion (/login, /verify) et écran profil (/welcome) : sans barre de
// navigation, jamais indexés. Le contrôle de connexion est fait dans chaque page.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function AuthLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <AuthScreenLayout>{children}</AuthScreenLayout>;
}
