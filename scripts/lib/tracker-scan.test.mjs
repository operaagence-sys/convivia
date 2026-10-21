import { describe, expect, it } from 'vitest';
import {
  extractAssetUrls,
  extractManifestChunks,
  findTrackers,
  loadSignatures,
} from './tracker-scan.mjs';

describe('findTrackers', () => {
  const cases = [
    ['PostHog', 'import posthog from "posthog-js"; posthog.init("x")'],
    ['PostHog', 'fetch("https://eu.i.posthog.com/e/")'],
    ['Vercel Analytics', '<script src="/_vercel/insights/script.js"></script>'],
    ['Vercel Speed Insights', 'import "@vercel/speed-insights"'],
    ['Google Analytics / Tag Manager', 'gtag("config", "G-XXXX")'],
    ['Google Analytics / Tag Manager', 'src="https://www.googletagmanager.com/gtm.js?id=GTM-1"'],
    ['Pixel Meta', 'fbq("init", "123"); fbq("track", "PageView")'],
    ['Pixel Meta', 'https://connect.facebook.net/en_US/fbevents.js'],
    ['Hotjar', 'static.hotjar.com/c/hotjar-1.js'],
    ['Microsoft Clarity', 'https://www.clarity.ms/tag/abc'],
    ['Sentry (navigateur)', 'import * as Sentry from "@sentry/browser"'],
    ['Sentry (navigateur)', 'https://o1.ingest.de.sentry.io/api/2/envelope/'],
    ['Session Replay', 'Sentry.replayIntegration()'],
    ['Session Replay', 'import { record } from "rrweb"'],
  ];

  it.each(cases)('détecte %s dans %j', (name, source) => {
    expect(findTrackers(source)).toContain(name);
  });

  it('ne signale rien dans un code applicatif normal', () => {
    const clean =
      'self.__next_f.push([1,"<main><h1>Invitation</h1></main>"]); const t = setTimeout(() => {}, 10);';
    expect(findTrackers(clean)).toEqual([]);
  });

  it('charge au moins une signature par outil exigé par le TRD', () => {
    const names = loadSignatures().map((entry) => entry.name);
    for (const expected of [
      'PostHog',
      'Vercel Analytics',
      'Google Analytics / Tag Manager',
      'Pixel Meta',
      'Hotjar',
      'Microsoft Clarity',
      'Sentry (navigateur)',
      'Session Replay',
    ]) {
      expect(names).toContain(expected);
    }
  });
});

describe('extractAssetUrls', () => {
  it('liste scripts, feuilles de style et ressources de même ou d’autre origine', () => {
    const html = `
      <link rel="stylesheet" href="/_next/static/css/a.css"/>
      <script src="/_next/static/chunks/b.js" async></script>
      <script src="https://cdn.example.test/lib.js"></script>
      <a href="/mentions-legales">Mentions</a>`;
    expect(extractAssetUrls(html).sort()).toEqual([
      '/_next/static/chunks/b.js',
      '/_next/static/css/a.css',
      'https://cdn.example.test/lib.js',
    ]);
  });
});

describe('extractManifestChunks', () => {
  it('extrait les chemins de fragments d’un manifeste client', () => {
    const manifest =
      'globalThis.__RSC_MANIFEST["/i/[token]/page"]={"entryJSFiles":{"/x":["static/chunks/abc-123.js","static/chunks/app/i/[token]/page-9f.js"]},"entryCSSFiles":{"/y":[{"path":"static/css/zz.css"}]}}';
    expect(extractManifestChunks(manifest).sort()).toEqual([
      'static/chunks/abc-123.js',
      'static/chunks/app/i/[token]/page-9f.js',
      'static/css/zz.css',
    ]);
  });
});
