import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isProduction } from '@/lib/env/guards';
import { getServerEnv } from '@/lib/env/server';
import { Showcase } from './showcase';

export const metadata: Metadata = {
  title: 'Design system (démonstration)',
  robots: { index: false, follow: false },
};

// Évalué à chaque requête: l'environnement est lu au moment de la visite, pas figé au build.
export const dynamic = 'force-dynamic';

/** Page de validation du design system. Introuvable (404) en production. */
export default function DesignSystemPage() {
  if (isProduction(getServerEnv().VERCEL_ENV)) notFound();
  return <Showcase />;
}
