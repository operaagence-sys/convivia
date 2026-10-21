'use client';

import { messages } from '@/content/messages.fr';

// Autonome: remplace le layout racine. Ni composant de l'application, ni police externe.
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  const m = messages.globalError;
  return (
    <html lang="fr">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif' }}>
        <main
          style={{
            minHeight: '100dvh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
            padding: 24,
            textAlign: 'center',
          }}
        >
          <h1 style={{ fontSize: 24, margin: 0 }}>{m.title}</h1>
          <p style={{ margin: 0, maxWidth: 420 }}>{m.description}</p>
          <button
            type="button"
            onClick={() => reset()}
            aria-label={m.retryLabel}
            style={{ minHeight: 44, padding: '0 20px', fontSize: 16, fontWeight: 600 }}
          >
            {m.retry}
          </button>
        </main>
      </body>
    </html>
  );
}
