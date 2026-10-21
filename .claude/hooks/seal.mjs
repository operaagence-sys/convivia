// Seals the hooks: records the sha256 of every hook file and of .claude/settings.json
// in .claude/hooks/integrity.json. To be run by the PROJECT OWNER, in a terminal,
// after reviewing a change to the hooks or to the settings:
//
//   node .claude/hooks/seal.mjs          write the manifest
//   node .claude/hooks/seal.mjs --check  only verify (exit 1 if something differs)
//
// Until the manifest matches, run-hook.mjs asks for confirmation on every tool call
// (security hooks) instead of silently running code that nobody reviewed.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeManifest, verifyManifest, MANIFEST_NAME } from './lib/integrity.mjs';

const claudeDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

if (process.argv.includes('--check')) {
  const r = verifyManifest(claudeDir);
  if (r.ok) console.log('Hooks scellés : le manifeste correspond.');
  else console.log(`Écarts :\n- ${r.problems.join('\n- ')}`);
  process.exit(r.ok ? 0 : 1);
}

const manifest = computeManifest(claudeDir);
fs.writeFileSync(path.join(claudeDir, 'hooks', MANIFEST_NAME), JSON.stringify(manifest, null, 2) + '\n');
console.log(`Manifeste écrit : ${Object.keys(manifest.files).length} fichiers scellés.`);
