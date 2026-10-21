// Integrity manifest of the hooks and of .claude/settings.json (sha256 per file).
// Used by run-hook.mjs (verification, before any hook code is imported) and by
// seal.mjs (generation, run by the project owner in a terminal).
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const MANIFEST_NAME = 'integrity.json';

function listFiles(dir, filter) {
  try {
    return fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isFile() && filter(e.name)).map((e) => e.name).sort();
  } catch {
    return [];
  }
}

/** Files covered by the manifest, relative to the `.claude` directory (forward slashes). */
export function coveredFiles(claudeDir) {
  const hooks = path.join(claudeDir, 'hooks');
  return [
    'settings.json',
    ...listFiles(hooks, (n) => n.endsWith('.mjs') || n === 'allowed-packages.json').map((n) => `hooks/${n}`),
    ...listFiles(path.join(hooks, 'lib'), (n) => n.endsWith('.mjs')).map((n) => `hooks/lib/${n}`),
  ];
}

/** sha256 of the content, line endings normalised (a Windows checkout may rewrite them). */
export function hashFile(file) {
  const text = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  return crypto.createHash('sha256').update(text).digest('hex');
}

export function computeManifest(claudeDir) {
  const files = {};
  for (const rel of coveredFiles(claudeDir)) files[rel] = hashFile(path.join(claudeDir, rel));
  return { version: 1, algorithm: 'sha256', files };
}

/** @returns {{ok: boolean, problems: string[]}} */
export function verifyManifest(claudeDir) {
  const file = path.join(claudeDir, 'hooks', MANIFEST_NAME);
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return { ok: false, problems: [`${MANIFEST_NAME} absent ou illisible (le porteur du projet doit lancer « node .claude/hooks/seal.mjs »)`] };
  }
  const recorded = (manifest && manifest.files) || {};
  const problems = [];
  const current = coveredFiles(claudeDir);
  for (const rel of current) {
    if (!(rel in recorded)) problems.push(`${rel} : fichier non scellé`);
    else {
      try {
        if (hashFile(path.join(claudeDir, rel)) !== recorded[rel]) problems.push(`${rel} : modifié depuis le scellement`);
      } catch {
        problems.push(`${rel} : illisible`);
      }
    }
  }
  for (const rel of Object.keys(recorded)) if (!current.includes(rel)) problems.push(`${rel} : supprimé depuis le scellement`);
  return { ok: problems.length === 0, problems };
}
