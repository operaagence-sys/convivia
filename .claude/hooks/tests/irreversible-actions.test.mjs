import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { run, bash, tmpDir, HOOKS_DIR } from './helpers.mjs';

const S = 'irreversible-actions.mjs';
const d = (c, extra) => run(S, bash(c, extra)).decision;
const slash = (p) => p.replace(/\\/g, '/');

test('actions irréversibles réservées au porteur du projet -> deny', () => {
  const denies = [
    'git push', 'git push origin main', 'git push --force', 'git push -f origin main', 'git push --force-with-lease', 'git push origin +main', 'git -C x push -f', 'GIT PUSH --FORCE',
    'git push -u origin feature', 'git send-pack origin main',
    'rm -rf src', 'rm -rf /', 'rm -fr docs', 'rm -r ./supabase', 'rm -rf $HOME/x', 'rm -rf ..',
    'rm -rf *', 'rm -rf dist/../src', 'Remove-Item -Recurse -Force src', 'Remove-Item -Recurse C:\\Users\\x\\proj', 'ri -r src', 'rmdir /s /q src',
    'ls && rm -rf src', 'vercel --prod', 'vercel deploy --prod', 'vercel deploy', 'vercel promote dpl_123', 'npx vercel --prod', 'vercel --prod --yes', 'vercel',
    'npm publish', 'pnpm publish', 'supabase functions deploy whatsapp-dispatcher',
    'supabase secrets set FOO=bar', 'bash -c "git push --force"', 'echo $(git push)',
    'git config alias.x "!rm -rf /"', 'git -c core.fsmonitor=evil status', 'git rm -rf src',
  ];
  for (const c of denies) assert.equal(d(c), 'deny', c);
});

test('actions irréversibles qu\'un agent peut légitimement lancer -> ask', () => {
  const asks = [
    'git reset --hard', 'git reset --hard HEAD~3', 'git clean -fd', 'git clean -f', 'git clean --force', 'git branch -D feature',
    'git checkout -- .', 'git checkout .', 'git restore .', 'echo $(git reset --hard)',
  ];
  for (const c of asks) assert.equal(d(c), 'ask', c);
});

test('cas sûrs -> rien', () => {
  const ok = [
    'git status', 'git reset --soft HEAD~1', 'git reset HEAD file', 'git clean -n',
    'git branch -d done', 'git branch', 'git checkout main', 'git checkout -b x', 'git restore --staged .', 'git restore file.ts',
    'git config --get user.name', 'git config --list',
    'rm -rf node_modules', 'rm -rf ./node_modules', 'rm -rf .next', 'rm -rf dist coverage .turbo', 'rm -rf packages/web/dist', 'rm -rf node_modules/.cache',
    'rm file.txt', 'rm -f file.txt', 'rm -rf /tmp/foo', 'rm -rf /tmp/a /tmp/b', 'Remove-Item -Recurse -Force node_modules', 'rmdir emptydir',
    'rm -rf ' + slash(path.join(os.tmpdir(), 'x')), 'vercel --version', 'vercel env ls', 'vercel build',
    'npm install', 'npm ci', 'npm i', 'npm install --no-audit', 'npm run build', 'npm test', 'npm view lodash',
    'pnpm install', 'yarn install', 'yarn', 'npm install --prefix web', 'supabase functions serve', 'supabase secrets list', 'supabase start', 'supabase db reset',
    'git commit -m "rm -rf everything"', 'echo "git push --force"', 'del file.txt', 'del /p file.txt',
  ];
  for (const c of ok) assert.equal(d(c), 'none', c);
});

test('scratchpad_dir exempté pour rm -rf', () => {
  const sp = path.join(os.homedir(), 'scratch-xyz');
  assert.equal(d(`rm -rf ${slash(sp)}/out`, { scratchpad_dir: sp }), 'none');
  assert.equal(d(`rm -rf ${slash(sp)}/out`), 'deny');
  assert.equal(d(`rm -rf ${slash(sp)}`, { scratchpad_dir: sp }), 'deny'); // le dossier lui-même
  assert.equal(d(`rm -rf ${slash(sp)}/../other`, { scratchpad_dir: sp }), 'deny');
  assert.equal(d(`rm -rf ${slash(sp)}-evil/out`, { scratchpad_dir: sp }), 'deny');
});

test('git push : suppression de branche distante -> deny', () => {
  const denies = [
    'git push origin :main', 'git push origin :feature/x', 'git push origin --delete feature', 'git push --delete origin feature', 'git push -d origin x',
    'git push upstream :refs/tags/v1', 'git -C repo push origin :old', 'echo ok && git push origin :main',
    'git push origin main:main', 'git push origin HEAD:refs/heads/x',
  ];
  for (const c of denies) assert.equal(d(c), 'deny', c);
});

test('commandes cmd Windows : del /f /q, erase, rmdir /s -> deny', () => {
  const denies = [
    'del /f file.txt', 'del /q file.txt', 'del /f /q src\\*', 'del /s /q src', 'DEL /F /Q src', 'del /f/q src\\a.ts', 'erase /f file', 'erase /q /s src',
    'rmdir /s src', 'rmdir /s /q src', 'rd /s /q docs', 'echo x && del /q docs\\a.md',
  ];
  for (const c of denies) assert.equal(d(c), 'deny', c);
  const ok = [
    'del /f /q node_modules\\x', 'rmdir /s /q node_modules', 'rd /s /q .next', 'del /s /q dist\\*', 'rmdir /s /q packages\\web\\dist',
    'rd /s /q ' + path.join(os.tmpdir(), 'x'), 'del /f /q "' + path.join(os.tmpdir(), 'x', 'a.txt') + '"', 'rmdir /s /q %TEMP%\\foo',
  ];
  for (const c of ok) assert.equal(d(c), 'none', c);
});

test('dossiers temporaires : chemins RÉSOLUS sous le dossier temporaire système seulement', () => {
  const t = slash(os.tmpdir());
  const denies = [
    `rm -rf ${t}/../x`, `rm -rf ${t}/a/../../x`, 'rm -rf /tmp/../etc', 'rm -rf /tmp', `rm -rf ${t}`, 'rm -rf %TEMP%', 'rm -rf %TEMP%\\..\\x',
    'rm -rf /tmp/*', `rm -rf ${t}/*`, 'rm -rf $TMPDIR/x', 'rm -rf /tmpx/foo', `rm -rf ${t}-other/x`, 'rm -rf tmp/foo',
    'del /f /q /tmp/../x',
  ];
  for (const c of denies) assert.equal(d(c), 'deny', c);
  assert.equal(d('rm -rf %TEMP%\\convivia-x'), 'none');
  assert.equal(d('rm -rf %temp%/convivia-x'), 'none');
});

test('dossier temporaire : un lien (jonction) vers l\'extérieur n\'est pas exempté', () => {
  const inside = tmpDir('convivia-inside-');
  const home = path.join(os.homedir(), `convivia-hook-link-${process.pid}`);
  fs.mkdirSync(home, { recursive: true });
  const link2 = path.join(inside, 'tohome');
  try {
    fs.symlinkSync(home, link2, 'junction');
    assert.equal(d(`rm -rf ${slash(link2)}/data`), 'deny');
    assert.equal(d(`rm -rf ${slash(link2)}`), 'deny');
  } finally {
    try { fs.unlinkSync(link2); } catch { /* ignore */ }
    try { fs.rmSync(home, { recursive: true, force: true }); } catch { /* ignore */ }
  }
});

test('dépendances : liste blanche du socle -> aucune confirmation', () => {
  const ok = [
    'npm install next', 'npm install next@latest react react-dom', 'npm i next@15.1.0', 'npm install @supabase/supabase-js @supabase/ssr',
    'npm install fedapay qrcode zxing-wasm exceljs sharp browser-image-compression', 'npm install @sentry/nextjs posthog-js', 'npm install serwist @serwist/next',
    'npm install -D vitest', 'npm install --save-dev vitest@^3', 'npm i -D @playwright/test eslint eslint-config-next prettier typescript', 'npm install -D @types/node @types/react @types/react-dom',
    'npm install -D @types/qrcode', 'npm add -D @lhci/cli', 'pnpm add next react', 'yarn add @supabase/ssr', 'bun add sharp', 'npm install libphonenumber-js',
    'npm install --save-exact next@15', 'npm install -D supabase', 'npx next build', 'cd web && npm install next',
  ];
  for (const c of ok) assert.equal(d(c), 'none', c);
});

test('dépendances hors liste, noms proches, portées différentes, sources exotiques -> ask', () => {
  const asks = [
    'npm install lodash', 'npm i lodash', 'npm add left-pad', 'pnpm add left-pad', 'yarn add left-pad', 'bun add left-pad', 'npm install -g vercel', 'npm install left-pad next',
    'npm install nxt', 'npm install reakt', 'npm install reactt', 'npm install sharpp', 'npm install exceljss', 'npm install @supabase/ssrr', 'npm install @evil/sharp',
    'npm install @supabasee/ssr', 'npm install -D vitets', 'npm install posthog-jss', 'npm install fedapai', 'npm install @sentry/nextjss', 'npm install supabase-js',
    'npm install ./local-pkg', 'npm install ../other', 'npm install https://example.com/x.tgz', 'npm install git+https://github.com/a/b.git', 'npm install github:a/b',
    'npm install file:../x', 'npm install pkg.tgz', 'npm install next --registry https://evil.example', 'npm install next --registry=https://evil.example',
    'npm install -g typescript', 'npm install --global prettier', 'npm install next lodash',
  ];
  for (const c of asks) assert.equal(d(c), 'ask', c);
});

test('dépendances : le message distingue « hors liste » et « nom proche de X »', () => {
  const near = run(S, bash('npm install reakt'));
  assert.match(near.reason, /nom proche de « react »/);
  assert.match(near.reason, /hors liste/);
  const scope = run(S, bash('npm install @evil/sharp'));
  assert.match(scope.reason, /nom proche de « sharp »/);
  const far = run(S, bash('npm install lodash'));
  assert.match(far.reason, /hors liste/);
  assert.doesNotMatch(far.reason, /nom proche/);
  const mixed = run(S, bash('npm install next lodash'));
  assert.match(mixed.reason, /lodash/);
  assert.doesNotMatch(mixed.reason, /« next »/);
});

test('la liste blanche est un JSON valide, sans doublon, et contient les paquets du socle', () => {
  const file = path.join(HOOKS_DIR, 'allowed-packages.json');
  const j = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.ok(Array.isArray(j.packages) && j.packages.length > 20);
  assert.equal(new Set(j.packages).size, j.packages.length);
  for (const p of ['next', 'react', '@supabase/supabase-js', '@supabase/ssr', 'fedapay', 'qrcode', 'zxing-wasm', 'exceljs', 'sharp', 'browser-image-compression', '@sentry/nextjs', 'posthog-js', 'serwist', 'vitest', '@playwright/test', 'eslint', 'eslint-config-next', 'prettier', 'typescript', '@types/node']) {
    assert.ok(j.packages.includes(p), p);
  }
  for (const p of j.packages) assert.ok(/^(@[a-z0-9._-]+\/)?[a-z0-9._-]+$/.test(p), p);
});

test('commandes composées', () => {
  assert.equal(d('cd x; git push -f'), 'deny');
  assert.equal(d('cd x && git push --force origin main'), 'deny');
  assert.equal(d('git add . && git commit -m x && git push --force-with-lease'), 'deny');
  assert.equal(d('echo ok || rm -rf src'), 'deny');
  assert.equal(d('npm ci && npm install lodash'), 'ask');
  assert.equal(d('cd x; npm install next'), 'none');
  assert.equal(d('git status; git push'), 'deny');
});

test('chemins Windows : antislashs et casse', () => {
  assert.equal(d('Remove-Item -Recurse -Force C:\\Users\\x\\proj\\SRC'), 'deny');
  assert.equal(d('Remove-Item -Recurse -Force .\\NODE_MODULES'), 'none');
  assert.equal(d('rm -rf .\\Supabase\\Migrations'), 'deny');
  assert.equal(d('RM -RF SRC'), 'deny');
  assert.equal(d('rd /s /q .\\SUPABASE\\MIGRATIONS'), 'deny');
  assert.equal(d('rd /s /q packages\\Web\\Dist'), 'none');
});

test('échec fermé', () => {
  assert.equal(run(S, null, { raw: '' }).decision, 'deny');
});
