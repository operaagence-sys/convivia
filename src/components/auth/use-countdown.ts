'use client';

import { useEffect, useState } from 'react';

/**
 * Décompte en secondes entières, de `seconds` à 0. Repart de `seconds` quand `seconds` ou
 * `restartKey` change (ex. nouveau code renvoyé, nouveau blocage reçu).
 */
export function useCountdown(seconds: number, restartKey: unknown = 0): number {
  const start = Math.max(0, Math.ceil(seconds));
  const [remaining, setRemaining] = useState(start);
  const [seen, setSeen] = useState({ start, restartKey });

  // Réinitialisation pendant le rendu (schéma recommandé par React, sans effet intermédiaire).
  if (seen.start !== start || seen.restartKey !== restartKey) {
    setSeen({ start, restartKey });
    setRemaining(start);
  }

  const active = remaining > 0;
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setRemaining((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(id);
  }, [active, seen]);

  return remaining;
}
