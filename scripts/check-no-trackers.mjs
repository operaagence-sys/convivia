#!/usr/bin/env node
/**
 * Contrôle CI: aucun traceur ni SDK d'analyse dans ce que le navigateur charge sur /i/*
 * (CLAUDE.md 5, TRD 12.2). Limite connue du hook guest-privacy: il ne suit pas les imports
 * indirects, ce contrôle regarde le résultat réel.
 *
 * Prérequis: `npm run build` déjà fait. Le script démarre lui-même `next start`.
 *   node scripts/check-no-trackers.mjs [--path /i/<jeton>] [--port 3300]
 *
 * Deux vérifications:
 *  1. ce que le serveur renvoie pour la page (HTML + chaque script/feuille de style même
 *     origine), et toute ressource d'une autre origine est elle-même une erreur;
 *  2. tous les fragments listés dans le manifeste client de la route (y compris ceux
 *     chargés plus tard, après l'ouverture de l'enveloppe).
 */
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { extractAssetUrls, extractManifestChunks, findTrackers } from './lib/tracker-scan.mjs';

const root = process.cwd();
const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};

const pagePath = option('--path', '/i/LighthouseTestToken000');
const port = Number(option('--port', '3300'));
const base = `http://localhost:${port}`;
const problems = [];
let totalBytes = 0;

function report(where, trackers) {
  for (const name of trackers) problems.push(`${name} détecté dans ${where}`);
}

function scan(where, source) {
  totalBytes += Buffer.byteLength(source);
  report(where, findTrackers(source));
}

async function waitForServer(server) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (server.exitCode !== null) throw new Error('Le serveur next start s’est arrêté.');
    try {
      const response = await fetch(`${base}/robots.txt`);
      if (response.ok) return;
    } catch {
      // pas encore prêt
    }
    await sleep(500);
  }
  throw new Error('Le serveur next start n’a pas répondu en 60 s.');
}

function manifestFiles() {
  // `.next/server/app/i/[token]/page_client-reference-manifest.js`
  const dir = path.join(root, '.next', 'server', 'app', 'i');
  if (!existsSync(dir)) return [];
  const found = [];
  const walk = (current) => {
    for (const entry of readdirSync(current)) {
      const full = path.join(current, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (entry.endsWith('_client-reference-manifest.js')) found.push(full);
    }
  };
  walk(dir);
  return found;
}

async function main() {
  if (!existsSync(path.join(root, '.next', 'BUILD_ID'))) {
    console.error('Aucun build trouvé: lance `npm run build` avant ce contrôle.');
    process.exit(2);
  }

  const server = spawn(
    process.execPath,
    [path.join(root, 'node_modules', 'next', 'dist', 'bin', 'next'), 'start', '-p', String(port)],
    { cwd: root, stdio: 'ignore', env: { ...process.env, NODE_ENV: 'production' } },
  );

  try {
    await waitForServer(server);

    // 1. Ce que reçoit réellement un visiteur.
    const response = await fetch(`${base}${pagePath}`);
    if (response.status !== 200) {
      throw new Error(`${pagePath} répond ${response.status} (200 attendu).`);
    }
    const html = await response.text();
    scan(`le HTML de ${pagePath}`, html);

    for (const asset of extractAssetUrls(html)) {
      const url = new URL(asset, base);
      if (url.origin !== base) {
        problems.push(`ressource d’une autre origine chargée par ${pagePath}: ${url.origin}`);
        continue;
      }
      const assetResponse = await fetch(url);
      if (!assetResponse.ok) continue;
      scan(`${url.pathname}`, await assetResponse.text());
    }

    // 2. Tous les fragments que la route peut charger.
    const manifests = manifestFiles();
    if (manifests.length === 0) {
      console.warn('Avertissement: aucun manifeste client trouvé pour /i/* (contrôle 2 sauté).');
    }
    const seen = new Set();
    for (const manifest of manifests) {
      for (const chunk of extractManifestChunks(readFileSync(manifest, 'utf8'))) {
        if (seen.has(chunk)) continue;
        seen.add(chunk);
        const file = path.join(root, '.next', chunk);
        if (existsSync(file)) scan(`.next/${chunk}`, readFileSync(file, 'utf8'));
      }
    }
  } finally {
    server.kill();
  }

  const kib = (totalBytes / 1024).toFixed(0);
  if (problems.length > 0) {
    console.error(`Traceurs trouvés dans le bundle de /i/* (${kib} Kio analysés):`);
    for (const problem of problems) console.error(`  - ${problem}`);
    process.exit(1);
  }
  console.log(`OK: aucun traceur dans /i/* (${kib} Kio analysés, non compressés).`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(2);
});
