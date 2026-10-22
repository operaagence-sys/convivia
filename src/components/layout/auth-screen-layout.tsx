import type { ReactNode } from 'react';

/**
 * Mise en page des écrans publics de connexion (`/login`, `/verify`, profil) : fond `bg-page`,
 * carte blanche centrée, sans bloc héros (04 § 11.1) et SANS barre de navigation.
 * Ne porte pas de titre : chaque formulaire rend son propre `<h1>`.
 */
export function AuthScreenLayout({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-4 py-8">
      <p aria-hidden className="text-center text-h3 text-accent-600">
        Convivia
      </p>
      <div className="rounded-lg border border-border-subtle bg-surface p-6">{children}</div>
    </main>
  );
}
