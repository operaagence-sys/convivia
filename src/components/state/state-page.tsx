import type { ReactNode } from 'react';

type StatePageProps = {
  title: string;
  description: string;
  children?: ReactNode;
};

/** Page d'état minimale (404, erreur, bientôt disponible). Aucun import tiers. */
export function StatePage({ title, description, children }: StatePageProps) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-bold">{title}</h1>
      <p>{description}</p>
      {children}
    </main>
  );
}

export const stateActionClass =
  'inline-flex min-h-11 items-center justify-center rounded-lg border px-5 font-semibold';
