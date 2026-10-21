import { readFileSync } from 'node:fs';

/**
 * Détection de traceurs dans ce que charge une page invité (/i/*).
 * Les signatures sont dans `scripts/tracker-signatures.json` (données, pas code).
 */

const signatureFile = new URL('../tracker-signatures.json', import.meta.url);

/** @returns {{ name: string; pattern: RegExp }[]} */
export function loadSignatures() {
  const raw = JSON.parse(readFileSync(signatureFile, 'utf8'));
  return raw.signatures.map((entry) => ({
    name: entry.name,
    pattern: new RegExp(entry.pattern, 'i'),
  }));
}

const SIGNATURES = loadSignatures();

/**
 * @param {string} source contenu d'un fichier (HTML, JS ou CSS)
 * @returns {string[]} noms des traceurs détectés
 */
export function findTrackers(source) {
  return SIGNATURES.filter(({ pattern }) => pattern.test(source)).map(({ name }) => name);
}

/**
 * Extrait les ressources (scripts, feuilles de style, préchargements, polices) référencées
 * par un HTML, telles qu'écrites dans le HTML.
 * @param {string} html
 * @returns {string[]}
 */
export function extractAssetUrls(html) {
  const urls = new Set();
  for (const match of html.matchAll(/\b(?:src|href)\s*=\s*"([^"]+)"/gi)) {
    const value = match[1];
    if (!value) continue;
    if (/\.(?:js|mjs|css|wasm|woff2?)(?:\?|$)/i.test(value) || value.includes('/_next/')) {
      urls.add(value);
    }
  }
  return [...urls];
}

/**
 * Extrait d'un manifeste client Next.js les chemins de fragments JS/CSS de la page.
 * @param {string} manifestSource
 * @returns {string[]} chemins relatifs à `.next/` (ex. `static/chunks/abc.js`)
 */
export function extractManifestChunks(manifestSource) {
  const chunks = new Set();
  for (const match of manifestSource.matchAll(
    /static\/(?:chunks|css)\/[A-Za-z0-9_./~()[\]-]+?\.(?:js|css)/g,
  )) {
    chunks.add(match[0]);
  }
  return [...chunks];
}
