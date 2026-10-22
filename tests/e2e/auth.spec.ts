import { expect, test, type Page } from '@playwright/test';

// Tranche 2 : connexion organisateur. Joue sur le build de production (`next start`) SANS vrai
// Supabase : l'URL Supabase du test pointe vers un port local fermé (variables passées par le
// shell, voir l'en-tête de playwright.config.ts). Aucune requête ne sort de la machine et aucun
// e-mail n'est envoyé.

const INVITATION_PATH = '/i/LighthouseTestToken000';
const PROTECTED = ['/dashboard', '/account', '/events/new', '/welcome'];

function setCookieHeaders(response: { headersArray(): { name: string; value: string }[] }) {
  return response.headersArray().filter((h) => h.name.toLowerCase() === 'set-cookie');
}

// TRD § 7, 09 § 2 : pas de session, pas de page protégée.
for (const path of PROTECTED) {
  test(`${path} sans session : redirection vers /login`, async ({ page }) => {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: 'Connexion' })).toBeVisible();
  });
}

test('/verify sans e-mail en attente : proposition de revenir à la connexion', async ({ page }) => {
  await page.goto('/verify');
  await expect(page.getByText(/n.est plus à jour/)).toBeVisible();
  await page.getByRole('button', { name: 'Retour à la connexion' }).click();
  await expect(page).toHaveURL(/\/login$/);
});

// D57 : /signup garde ?ref= (valide) dans la redirection, rien d'autre.
test('/signup?ref=AMINA-10 : /login?ref=AMINA-10', async ({ page }) => {
  await page.goto('/signup?ref=AMINA-10');
  await expect(page).toHaveURL(/\/login\?ref=AMINA-10$/);
});

for (const hostile of [
  '%3Cscript%3Ealert(1)%3C%2Fscript%3E',
  '%2F%2Fevil.example',
  'https%3A%2F%2Fevil.example',
  'a%0d%0aSet-Cookie%3Ax%3D1',
  'a'.repeat(65),
]) {
  test(`/signup?ref=${hostile.slice(0, 24)} : /login sans ref, aucun cookie`, async ({
    page,
    context,
  }) => {
    await page.goto(`/signup?ref=${hostile}`);
    await expect(page).toHaveURL(/\/login$/);
    expect(new URL(page.url()).search).toBe('');
    expect(await context.cookies()).toEqual([]);
  });
}

test('/signup sans ref : /login', async ({ page }) => {
  await page.goto('/signup');
  await expect(page).toHaveURL(/\/login$/);
});

// 02 § 1.1 : écran de connexion plein écran, sans barre de navigation.
test('/login : formulaire affiché, sans barre de navigation', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByLabel('Adresse e-mail')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Recevoir un code' })).toBeVisible();
  await expect(page.getByRole('navigation')).toHaveCount(0);
  const robots = await page.locator('meta[name="robots"]').getAttribute('content');
  expect(robots).toContain('noindex');
});

test('/login : aucun cookie posé pour un visiteur anonyme, rien ne sort du site', async ({
  page,
  context,
  baseURL,
}) => {
  const foreign: string[] = [];
  const origin = new URL(baseURL ?? '').origin;
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (!url.href.startsWith('data:') && url.origin !== origin) foreign.push(url.origin);
  });
  await page.goto('/login', { waitUntil: 'networkidle' });
  expect(await context.cookies()).toEqual([]);
  expect(foreign).toEqual([]);
});

async function submitEmail(page: Page, value: string) {
  await page.getByLabel('Adresse e-mail').fill(value);
  await page.getByRole('button', { name: 'Recevoir un code' }).click();
}

test('/login : adresse vide ou invalide refusée dans le formulaire, sans appel serveur', async ({
  page,
}) => {
  const posts: string[] = [];
  page.on('request', (request) => {
    if (request.method() === 'POST') posts.push(request.url());
  });
  await page.goto('/login');
  await page.getByRole('button', { name: 'Recevoir un code' }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'Entrez votre adresse e-mail.' }),
  ).toBeVisible();
  await submitEmail(page, 'pas-une-adresse');
  await expect(page.getByText(/ne semble pas correcte/)).toBeVisible();
  expect(posts).toEqual([]);
  await expect(page).toHaveURL(/\/login$/);
});

// État d'erreur : base injoignable (port fermé) -> message générique, pas de passage à /verify,
// l'adresse n'est jamais dans l'URL et aucun cookie « e-mail en attente » n'est posé.
test('/login : service injoignable -> erreur claire, pas de /verify, pas de cookie', async ({
  page,
  context,
}) => {
  await page.goto('/login');
  await submitEmail(page, 'awa.test@exemple.com');
  await expect(page.getByText(/n.a pas pu être envoyé|Impossible de vous joindre/)).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
  expect(page.url()).not.toContain('awa');
  const names = (await context.cookies()).map((c) => c.name);
  expect(names).not.toContain('convivia_login_email');
});

// CLAUDE.md § 5 : aucun cookie ni traceur sur /i/*, même après être passé par /login.
test('/i/* : toujours aucun Set-Cookie après des visites de /login et /verify', async ({
  page,
  request,
}) => {
  await page.goto('/login');
  await page.goto('/verify');
  const withCookies = await page.context().cookies();
  const response = await request.get(INVITATION_PATH, {
    headers: {
      cookie: [...withCookies.map((c) => `${c.name}=${c.value}`), 'sb-fake-auth-token=abc'].join(
        '; ',
      ),
    },
  });
  expect(response.status()).toBe(200);
  expect(setCookieHeaders(response)).toEqual([]);
});

test('/i/* : aucun cookie dans le navigateur, aucune requête vers /login ni Supabase', async ({
  page,
  context,
}) => {
  const requested: string[] = [];
  page.on('request', (request) => requested.push(request.url()));
  await page.goto(INVITATION_PATH, { waitUntil: 'networkidle' });
  expect(await context.cookies()).toEqual([]);
  expect(requested.filter((u) => /supabase|54399|\/login|\/verify/.test(u))).toEqual([]);
});

test('pages de connexion : jamais mises en cache publiquement', async ({ request }) => {
  for (const path of ['/login', '/verify', '/dashboard']) {
    const response = await request.get(path, { maxRedirects: 0 });
    const cacheControl = response.headers()['cache-control'] ?? '';
    expect(cacheControl, path).not.toMatch(/public|s-maxage=[1-9]/);
  }
});
