import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { run, write, edit, multiEdit, emptyProject } from './helpers.mjs';

const S = 'guest-privacy.mjs';
const d = (input) => run(S, input).decision;
const proj = emptyProject();
const guestPage = path.join(proj, 'src', 'app', 'i', '[token]', 'page.tsx');
const appPage = path.join(proj, 'app', 'i', '[token]', 'page.tsx');
const groupPage = path.join(proj, 'src', 'app', '(guest)', 'welcome', 'page.tsx');
const otherPage = path.join(proj, 'src', 'app', 'dashboard', 'page.tsx');
const shared = path.join(proj, 'src', 'components', 'shared', 'footer.tsx');
const marketing = [
  path.join(proj, 'src', 'app', '(marketing)', 'page.tsx'),
  path.join(proj, 'app', '(marketing)', 'pricing', 'page.tsx'),
  path.join(proj, 'src', 'lib', 'analytics', 'posthog.ts'),
  path.join(proj, 'lib', 'analytics', 'client.ts'),
];

const TRACKER_SNIPPETS = [
  "import posthog from 'posthog-js';", "import { PostHogProvider } from 'posthog-js/react';", "import { Analytics } from '@vercel/analytics/react';",
  "import { SpeedInsights } from '@vercel/speed-insights/next';", "gtag('event', 'x');", '<script src="https://www.googletagmanager.com/gtm.js">',
  "fbq('track', 'PageView');", 'import hotjar from "@hotjar/browser";', "clarity('set', 'a', 'b');", 'integrations: [Sentry.replayIntegration()]',
  'const x = 1; // posthog',
];

test('traceurs interdits sur /i/*', () => {
  for (const c of TRACKER_SNIPPETS) {
    for (const f of [guestPage, appPage, groupPage]) {
      assert.equal(d(write(f, c)), 'deny', `${path.basename(path.dirname(f))}: ${c}`);
    }
  }
  assert.equal(d(edit(guestPage, "import posthog from 'posthog-js'")), 'deny');
  assert.equal(d(multiEdit(guestPage, [{ old_string: 'a', new_string: 'ok' }, { old_string: 'b', new_string: 'gtag("x")' }])), 'deny');
});

test('traceurs refusés PARTOUT hors liste blanche (composants partagés, autres pages)', () => {
  for (const c of TRACKER_SNIPPETS) {
    for (const f of [otherPage, shared, path.join(proj, 'src', 'app', 'invite', 'page.tsx'), path.join(proj, 'src', 'lib', 'tracking.ts'), path.join(proj, 'instrumentation-client.ts'), path.join(proj, 'src', 'app', 'layout.tsx')]) {
      assert.equal(d(write(f, c)), 'deny', `${path.basename(f)}: ${c}`);
    }
  }
  assert.match(run(S, write(shared, "import posthog from 'posthog-js'")).reason, /marketing/);
});

test('traceurs autorisés seulement dans la vitrine et lib/analytics', () => {
  for (const f of marketing) {
    for (const c of TRACKER_SNIPPETS) assert.equal(d(write(f, c)), 'none', `${path.relative(proj, f)}: ${c}`);
  }
  // fichiers de test ignorés
  assert.equal(d(write(guestPage.replace('.tsx', '.test.tsx'), "import posthog from 'posthog-js';")), 'none');
  // ressemblance de nom : pas dans la liste blanche
  assert.equal(d(write(path.join(proj, 'src', 'app', 'marketing', 'page.tsx'), "import posthog from 'posthog-js';")), 'deny');
  assert.equal(d(write(path.join(proj, 'src', 'lib', 'analytics-helpers', 'a.ts'), "import posthog from 'posthog-js';")), 'deny');
  assert.equal(d(write(path.join(proj, 'src', 'components', '(marketing)', 'a.tsx'), "import posthog from 'posthog-js';")), 'deny');
});

test('chemins Windows (antislashs) et casse', () => {
  const win = (p) => p.replace(/\//g, '\\');
  assert.equal(d(write(`${proj}\\src\\app\\I\\[token]\\page.tsx`, "import posthog from 'posthog-js';")), 'deny');
  assert.equal(d(write(`${proj}\\SRC\\APP\\(GUEST)\\x\\page.tsx`, 'gtag("x")')), 'deny');
  assert.equal(d(write(`${proj}\\src\\app\\dashboard\\page.tsx`, "import posthog from 'posthog-js';")), 'deny');
  assert.equal(d(write(`${proj}\\src\\app\\(Marketing)\\page.tsx`, "import posthog from 'posthog-js';")), 'none');
  assert.equal(d(write(`${proj}\\src\\LIB\\Analytics\\ph.ts`, "import posthog from 'posthog-js';")), 'none');
  assert.equal(d(write(win(shared), 'gtag("x")')), 'deny');
  assert.equal(d(write(`${proj}\\SRC\\App\\I\\[token]\\Page.tsx`, 'console.log(guest.phone_e164)')), 'deny');
});

test('noms de variables d\'environnement et pages propres permis', () => {
  assert.equal(d(write(path.join(proj, 'src', 'lib', 'env.ts'), 'const k = process.env.NEXT_PUBLIC_POSTHOG_KEY;')), 'none');
  assert.equal(d(write(guestPage, 'export default function Page() { return <main>Bienvenue</main>; }')), 'none');
  assert.equal(d(write(otherPage, 'export default function Page() { return <main>Tableau de bord</main>; }')), 'none');
});

test('données d\'invité interdites dans journaux, Sentry, PostHog, analytics_events', () => {
  const f = otherPage;
  const bad = [
    'console.log(guest.phone_e164);', 'console.error("failed", { phoneE164 });', 'console.warn(`bad ${guest.full_name}`)', 'console.info(guestContacts)',
    'logger.info({ first_name })', 'logger.error(guest.companion_name)', 'Sentry.captureException(err, { extra: { phone: guest.phone } });',
    'Sentry.captureMessage(`x ${contact.phone_e164}`)', 'posthog.capture("sent", { phone: g.phone })', 'console.log("p", "phone_e164", row.phone_e164)',
    "supabase.from('analytics_events').insert({ name: 'x', props: { phone_e164: p } });", "await db.from('analytics_events').insert({ full_name })",
    'console.log(JSON.stringify(guest_contacts))', 'console.log(\n  data.phone,\n)',
    // nouveaux champs
    'console.log(guest.phoneNumber)', 'console.log(contact.fullName)', 'console.error({ lastName })', 'logger.info(row.last_name)', 'console.log(`hello ${g.lastName}`)',
    'Sentry.setContext("guest", { phoneNumber })',
    // objet entier
    'console.log(guest);', 'console.log("sent", guest)', 'console.error(contact)', 'console.log(guestContact)', 'console.warn(invitee, err)', 'logger.info({ guest })',
    'console.log(`failed for ${guest}`)', 'Sentry.captureException(err, { extra: { contact } })', 'console.log({ invitee })',
  ];
  for (const c of bad) assert.equal(d(write(f, c)), 'deny', c);
  assert.equal(d(write(guestPage, 'console.log(guest.phone_e164)')), 'deny');
});

test('journaux légitimes autorisés', () => {
  const f = otherPage;
  const ok = [
    'console.log(eventId);', 'console.error("insert failed", error);', 'console.log("phone verified for event", eventId)', 'logger.info({ guestId, eventId });',
    'Sentry.captureException(err);', 'Sentry.captureException(err, { tags: { route: "scan" } });',
    "supabase.from('analytics_events').insert({ name: 'event_created', props: { eventType } });", 'const phone = guest.phone; send(phone);',
    'console.log(`sent ${count} invitations`)', 'console.log(guest.id)', 'console.log(guest?.id, contact.id)', 'console.log({ guest: guest.id })',
    'console.log("guest", guestId)', 'logger.info({ guestCount: guests.length })', 'const contact = await load(); console.log(contact.id);',
  ];
  for (const c of ok) assert.equal(d(write(f, c)), 'none', c);
});

test("posthog.capture sans donnée d'invité autorisé dans lib/analytics", () => {
  assert.equal(d(write(marketing[2], 'posthog.capture("event_created", { eventType });')), 'none');
  assert.equal(d(write(marketing[2], 'posthog.capture("sent", { phone: g.phone });')), 'deny');
});

test('fichiers hors code et tests ignorés', () => {
  assert.equal(d(write(path.join(proj, 'docs', 'a.md'), 'console.log(guest.phone_e164)')), 'none');
  assert.equal(d(write(path.join(proj, 'src', 'a.test.ts'), 'console.log(guest.phone_e164)')), 'none');
  assert.equal(d(write(path.join(proj, 'tests', 'a.ts'), 'console.log(guest.phone_e164)')), 'none');
  assert.equal(d(write(path.join(proj, 'docs', 'a.md'), "import posthog from 'posthog-js'")), 'none');
});

test('échec fermé', () => {
  assert.equal(run(S, null, { raw: 'nope' }).decision, 'deny');
});
