import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';

// `globals` est désactivé : Testing Library ne nettoie pas le DOM toute seule.
// Chargé seulement quand un DOM existe (tests jsdom), pour ne pas alourdir les tests node.
afterEach(async () => {
  if (typeof document === 'undefined') return;
  const { cleanup } = await import('@testing-library/react');
  cleanup();
});
