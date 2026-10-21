import { expect, test } from '@playwright/test';

const INVITATION_PATH = '/i/LighthouseTestToken000';

test('la page d’accueil s’affiche', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Convivia' })).toBeVisible();
});

test('/i/* : en-têtes de confidentialité et de sécurité', async ({ request }) => {
  const response = await request.get(INVITATION_PATH);
  expect(response.status()).toBe(200);
  const headers = response.headers();
  expect(headers['x-robots-tag']).toBe('noindex, nofollow');
  expect(headers['referrer-policy']).toBe('no-referrer');
  expect(headers['x-content-type-options']).toBe('nosniff');
  const csp = headers['content-security-policy'] ?? '';
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).toContain("connect-src 'self'");
  // Aucune origine tierce autorisée sur la page invité.
  expect(csp).not.toMatch(/posthog|sentry|googletagmanager/i);
});

test('hors /i/* : pas d’indexation forcée, CSP applicative présente', async ({ request }) => {
  const response = await request.get('/');
  const headers = response.headers();
  expect(headers['x-robots-tag']).toBeUndefined();
  expect(headers['content-security-policy']).toContain("frame-ancestors 'none'");
  expect(headers['x-frame-options']).toBe('DENY');
});

test('robots.txt interdit /i/', async ({ request }) => {
  const response = await request.get('/robots.txt');
  expect(await response.text()).toMatch(/Disallow: \/i\//);
});

test('/i/* : aucune requête vers un autre domaine', async ({ page, baseURL }) => {
  const foreign: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (!url.href.startsWith('data:') && url.origin !== new URL(baseURL ?? '').origin) {
      foreign.push(url.origin);
    }
  });
  await page.goto(INVITATION_PATH, { waitUntil: 'networkidle' });
  expect(foreign).toEqual([]);
});

// TRD § 4, § 12.2 ; CLAUDE.md § 5 : aucun cookie ni traceur sur /i/*.
test('/i/* : aucun Set-Cookie, même avec un cookie de session reçu', async ({ request }) => {
  for (const headers of [
    {} as Record<string, string>,
    { cookie: 'sb-fake-auth-token=abc; other=1' },
  ]) {
    const response = await request.get(INVITATION_PATH, { headers });
    expect(response.status()).toBe(200);
    expect(response.headersArray().filter((h) => h.name.toLowerCase() === 'set-cookie')).toEqual(
      [],
    );
  }
});

test('/i/* : aucun cookie posé dans le navigateur, aucun script ni ressource tierce', async ({
  page,
  context,
  baseURL,
}) => {
  await page.goto(INVITATION_PATH, { waitUntil: 'networkidle' });
  expect(await context.cookies()).toEqual([]);
  const srcs = await page.$$eval('script[src], link[href], img[src], iframe', (els) =>
    els.map(
      (e) =>
        (e as HTMLElement & { src?: string; href?: string }).src ??
        (e as HTMLLinkElement).href ??
        '',
    ),
  );
  const origin = new URL(baseURL ?? '').origin;
  expect(srcs.filter((s) => s && !s.startsWith(origin) && !s.startsWith('data:'))).toEqual([]);
  expect(await page.locator('iframe').count()).toBe(0);
});

test('/i/<jeton inconnu inexistant> : pas de cookie non plus sur une 404', async ({ request }) => {
  const response = await request.get('/i/zzzzzzzzzzzzzzzzzzzzzzzz/inexistant');
  expect(response.headersArray().filter((h) => h.name.toLowerCase() === 'set-cookie')).toEqual([]);
  expect(response.headers()['x-robots-tag']).toBe('noindex, nofollow');
});

test('404 en français', async ({ page }) => {
  const response = await page.goto('/une-page-qui-nexiste-pas');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'Page introuvable' })).toBeVisible();
});

test('/design-system accessible hors production', async ({ page }) => {
  const response = await page.goto('/design-system');
  expect(response?.status()).toBe(200);
});

test('/design-system : CSP applicative et pas de fuite de jeton via Referer', async ({
  request,
}) => {
  const response = await request.get('/design-system');
  expect(response.headers()['referrer-policy']).toBe('strict-origin-when-cross-origin');
});
