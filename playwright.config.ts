import { defineConfig, devices } from '@playwright/test';

const PORT = 3100;
const baseURL = `http://localhost:${PORT}`;

/**
 * Playwright, profil mobile (Convivia est mobile-first). En CI, l'application est deja
 * construite: on la sert avec `next start`. En local, `next dev`.
 * Aucune cle ni appel reel: WhatsApp reste en `simulate` (valeur par defaut du code).
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'mobile-chrome', use: { ...devices['Pixel 7'] } }],
  webServer: {
    // `E2E_PROD=1` : sert le build de production deja construit (`npm run build`) avec `next start`.
    // Tests de connexion SANS vrai Supabase : lancer avec un port local ferme, par exemple
    //   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54399 (+ cle anonyme factice) au BUILD,
    //   puis les memes variables (sans les secrets serveur : la demande de code echoue alors
    //   proprement, ce que les tests verifient) au lancement de `E2E_PROD=1 npm run test:e2e`.
    command:
      process.env.CI || process.env.E2E_PROD
        ? `npm run start -- -p ${PORT}`
        : `npm run dev -- -p ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
