import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Alias `@/*` du tsconfig (résolution native de Vite).
    tsconfigPaths: true,
    alias: {
      // `server-only` lève une erreur hors serveur React; neutre en test.
      'server-only': path.resolve(import.meta.dirname, 'tests/stubs/server-only.ts'),
    },
  },
  test: {
    environment: 'node',
    // Poste lent (~4 s de demarrage par worker) : peu de workers.
    maxWorkers: 3,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'tests/unit/**/*.test.{ts,tsx}', 'scripts/**/*.test.mjs'],
    // Les tests de composants ajoutent `// @vitest-environment jsdom` en tête de fichier.
    exclude: ['node_modules', '.next', 'tests/e2e/**'],
    restoreMocks: true,
    unstubEnvs: true,
  },
});
