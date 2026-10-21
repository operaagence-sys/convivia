import { messages } from '@/content/messages.fr';

// 404 uniforme des liens invités (TRD § 4): aucun bouton, aucun lien, aucun traceur.
export default function GuestNotFound() {
  const m = messages.guestNotFound;
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-bold">{m.title}</h1>
      <p>{m.description}</p>
    </main>
  );
}
