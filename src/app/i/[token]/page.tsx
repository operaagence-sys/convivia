import type { Metadata } from 'next';

// ROUTE DE TEST PROVISOIRE (tranche 1). Elle sert uniquement de cible a Lighthouse CI et au
// controle "aucun traceur dans le bundle /i/*" (`npm run check:trackers`). Le frontend-developer
// la remplace par la vraie page invite (TRD 11.1: rendu serveur, `get_guest_view`, 404 pour un
// jeton inconnu). Ne rien importer de tiers ici (analytics, Sentry navigateur, etc.).
// Quand la vraie page existe, pointer lighthouserc.json et le controle vers un jeton de test.
export const metadata: Metadata = {
  title: 'Invitation',
  robots: { index: false, follow: false },
};

export default function InvitationPlaceholderPage() {
  return (
    <main>
      <h1>Invitation</h1>
      <p>Page invité de test.</p>
    </main>
  );
}
