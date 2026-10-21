import test from 'node:test';
import assert from 'node:assert/strict';
import { tokenize, allSegments, commandOf, baseProgram, extractSubstitutions } from '../lib/shell.mjs';
import { normalizePath, relPath, protectedKind, findSecrets, refsSecretVar } from '../lib/common.mjs';
import { fake } from './helpers.mjs';

test('tokenize : segments, guillemets, redirections', () => {
  const t = tokenize(`a "b c" 'd e' && f | g; h > out.txt 2>&1\ni >> "x y"`);
  assert.deepEqual(t.map((s) => s.words), [['a', 'b c', 'd e'], ['f'], ['g'], ['h'], ['i']]);
  assert.deepEqual(t[3].redirs, [{ op: '>', target: 'out.txt' }, { op: '>&', target: '1' }]);
  assert.deepEqual(t[4].redirs, [{ op: '>>', target: 'x y' }]);
});

test('tokenize : antislashs Windows conservés, heredoc ignoré, commentaires', () => {
  assert.deepEqual(tokenize('rm -rf C:\\Users\\x\\proj\\dist')[0].words, ['rm', '-rf', 'C:\\Users\\x\\proj\\dist']);
  const t = tokenize("cat > f <<'EOF'\nrm -rf /\nEOF\necho after");
  assert.deepEqual(t.map((s) => s.words), [['cat'], ['echo', 'after']]);
  assert.deepEqual(tokenize('echo a # rm -rf /')[0].words, ['echo', 'a']);
  assert.deepEqual(tokenize('echo "a # b"')[0].words, ['echo', 'a # b']);
});

test('substitutions et wrappers de shell dépliés', () => {
  assert.deepEqual(extractSubstitutions('echo $(cat .env) `ls` \'$(no)\''), ['cat .env', 'ls']);
  const words = allSegments('echo "$(cat .env)"').map((s) => s.words.join(' '));
  assert.ok(words.includes('cat .env'));
  assert.ok(allSegments('bash -c "rm -rf x"').some((s) => s.words[0] === 'rm'));
  assert.ok(allSegments('pwsh -Command "Remove-Item -Recurse x"').some((s) => s.words[0] === 'Remove-Item'));
  const enc = Buffer.from('Remove-Item -Recurse x', 'utf16le').toString('base64');
  assert.ok(allSegments(`powershell -EncodedCommand ${enc}`).some((s) => s.words[0] === 'Remove-Item'));
  assert.ok(allSegments('cmd /c "del /s x"').some((s) => s.words[0] === 'del'));
});

test('commandOf : préfixes ignorés', () => {
  assert.equal(commandOf(['FOO=1', 'npx', '-y', 'vercel', '--prod']).prog, 'vercel');
  assert.equal(commandOf(['sudo', 'rm', '-rf', 'x']).prog, 'rm');
  assert.equal(commandOf(['env', 'A=1', 'node', 'x.js']).prog, 'node');
  assert.equal(commandOf(['pnpm', 'dlx', 'supabase', 'db', 'reset']).prog, 'supabase');
  assert.equal(commandOf(['C:\\tools\\Supabase.EXE', 'db']).prog, 'supabase');
  assert.equal(baseProgram('./node_modules/.bin/vitest.cmd'), 'vitest');
});

test('chemins : Windows -> relatifs, minuscules, slash', () => {
  const root = 'C:\\Users\\Antonio\\Desktop\\Convivia';
  assert.equal(normalizePath('C:\\Users\\Antonio\\Desktop\\Convivia\\Supabase\\.ENV', root), 'supabase/.env');
  assert.equal(normalizePath('c:/users/antonio/desktop/convivia/src/A.ts', root), 'src/a.ts');
  assert.equal(normalizePath('.\\src\\..\\.env.local', root), '.env.local');
  // Un chemin qui n'existe pas garde la casse donnée ; un chemin qui existe prend la casse réelle du disque
  // (canonPath suit liens et casse réelle : c'est voulu, la comparaison de sécurité se fait en minuscules).
  assert.equal(relPath('C:\\Users\\Antonio\\Desktop\\Convivia\\Zz-Nouveau\\A.ts', root), 'Zz-Nouveau/A.ts');
  assert.equal(relPath('C:\\Users\\Antonio\\Desktop\\Convivia\\Src\\A.ts', root).toLowerCase(), 'src/a.ts');
  assert.equal(normalizePath('D:\\other\\x.ts', root), 'd:/other/x.ts');
  assert.match(normalizePath('/etc/passwd', root), /^(?:[a-z]:)?\/etc\/passwd$/);
});

test('protectedKind', () => {
  for (const f of ['.env', '.env.local', 'a/b/.env.production', 'supabase/.env.test', 'x.pem', 'x.key', 'x.p12']) assert.equal(protectedKind(f), 'secret', f);
  assert.equal(protectedKind('.env.example'), 'example');
  for (const f of ['environment.ts', 'env.ts', '.envrc.md', 'src/keys.ts', 'readme.md']) assert.equal(protectedKind(f), null, f);
});

test('findSecrets : détection et faux positifs', () => {
  for (const s of [fake.fedapayLive(), fake.fedapaySandbox(), fake.fedapayPkLive(), fake.webhook(), fake.meta(), fake.sbSecret(), fake.resend(), fake.pem(), fake.jwt('service_role')]) {
    assert.equal(findSecrets(`x ${s} y`).length, 1, s.slice(0, 12));
  }
  for (const s of [fake.jwt('anon'), fake.jwt('authenticated'), 'sk_live_', 'sk_' + 'live_short', 'process.env.RESEND_API' + '_KEY', 'EAA']) {
    assert.equal(findSecrets(s).length, 0, s.slice(0, 12));
  }
  assert.equal(refsSecretVar('$QR_SIGNING_SECRET'), true);
  assert.equal(refsSecretVar('${scan_session_secret}'), true);
  assert.equal(refsSecretVar('$env:RESEND_API_KEY'), true);
  assert.equal(refsSecretVar('$HOME'), false);
  assert.equal(refsSecretVar('$NEXT_PUBLIC_SUPABASE_URL'), false);
});
