import type { ReactNode } from 'react';

type AppShellProps = {
  children: ReactNode;
  /**
   * Barre de navigation inférieure : `<OrganizerBottomNav />`, `<EventBottomNav eventId />` ou
   * `<HostBottomNav eventId />`. Jamais dans les layouts de `/i/*`.
   */
  nav: ReactNode;
  /** Bandeau au-dessus du contenu (ex. `<SuspendedBanner />`). */
  banner?: ReactNode;
};

/**
 * Mise en page des écrans connectés (mobile-first) : colonne centrée de 576 px au plus, contenu
 * aéré (04 § 4) et marge basse qui réserve la barre fixe de 64 px + la zone sûre de l'iPhone.
 */
export function AppShell({ children, nav, banner }: AppShellProps) {
  return (
    <>
      <main className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 pt-6 pb-[calc(5rem+env(safe-area-inset-bottom))]">
        {banner}
        {children}
      </main>
      {nav}
    </>
  );
}
