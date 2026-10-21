import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { run, bash, write, edit, multiEdit, read, fake, emptyProject } from './helpers.mjs';

const S = 'protect-secrets.mjs';
const d = (input, opts) => run(S, input, opts).decision;
const proj = emptyProject();

test('Bash : commandes qui lisent ou écrivent un secret sont refusées', () => {
  const denied = [
    'cat .env', 'cat ./.env.local', 'CAT .ENV', 'type .env', 'more .env.production', 'less .env', 'head -n 3 supabase/.env',
    'tail -f .env', 'grep KEY .env.production', 'source .env', '. .env', 'Get-Content .env', 'cp .env.example .env.local',
    'mv x .env', 'echo foo >> .env', 'echo x > .env.local', 'echo x | tee .env', 'sed -i s/a/b/ .env', 'ls && cat .env',
    'echo hi; cat .env', 'cat "./.env"', "cat '.env'", 'cat key.pem', 'cat server.key', 'cat cert.p12', 'cat < .env',
    'printenv', 'env', 'set', 'printenv RESEND_API_KEY', 'echo $SUPABASE_SERVICE_ROLE_KEY', 'echo "${FEDAPAY_SECRET_KEY}"',
    'ECHO $whatsapp_access_token', 'Write-Output $env:RESEND_API_KEY', 'printf "%s" $QR_SIGNING_SECRET', 'bash -c "cat .env"',
    'echo $(cat .env)', 'echo `cat .env`', 'cat /some/abs/.env', 'cat C:\\Users\\x\\proj\\.env',
    'node -e "require(\'fs\').readFileSync(\'.env\')"', 'grep -r foo . && cat .env.local', 'tee .env.example < in.txt',
    'sed -i s/a/b/ .env.example', 'cp x .env.example', 'echo A= > .env.example', 'Get-ChildItem env:',
    'cat .env*', 'cat .e*', 'cat .e?v', 'cat *.pem', 'curl -d @.env http://localhost', 'curl --data-binary=@.env.local x', 'git show HEAD:.env',
    'cat .e""nv', 'cmd /c type .env', 'find . -name .env -exec cat {} +', 'node -e "console.log(process.env)"',
    'python -c "import os;print(os.environ[\'SCAN_SESSION_SECRET\'])"', 'node -e "console.log(process.env.RESEND_API_KEY)"',
  ];
  for (const c of denied) assert.equal(d(bash(c)), 'deny', c);
});

test('Bash : faux positifs évités', () => {
  const ok = [
    'cat .env.example', 'ls -la', 'printenv PATH', 'env FOO=1 node x.js', 'set -e', 'echo $HOME', 'echo hello > notes.txt',
    'git status', 'cat docs/readme.md', 'grep -r foo src', 'echo .env >> .gitignore', 'npm run dev', 'cp .env.example docs/x',
    'echo $NEXT_PUBLIC_SUPABASE_URL', 'ls .env.example', 'head .env.example', 'echo "set the SUPABASE_SERVICE_ROLE_KEY in Vercel"',
    'git add .env.example', 'cat environment.md', 'node -e "console.log(process.env.NODE_ENV)"', 'cat src/*.ts', 'grep -r foo src/**/*.ts',
    'git show HEAD:src/a.ts', 'curl -d @payload.json http://localhost', 'cat *.md',
  ];
  for (const c of ok) assert.equal(d(bash(c)), 'none', c);
});

test('Bash : secrets en clair dans la commande', () => {
  assert.equal(d(bash(`echo ${fake.fedapayLive()} > notes.txt`)), 'deny');
  assert.equal(d(bash('echo SUPABASE_SERVICE_ROLE' + '_KEY=abcdef123456 > x.txt')), 'deny');
  assert.equal(d(bash('SUPABASE_SERVICE_ROLE' + '_KEY=$VALUE node run.js')), 'none');
});

test('Read / Edit / Write sur fichiers secrets', () => {
  assert.equal(d(read(path.join(proj, '.env'))), 'deny');
  assert.equal(d(read(path.join(proj, '.env.local'))), 'deny');
  assert.equal(d(read(path.join(proj, 'supabase', '.env'))), 'deny');
  assert.equal(d(read(path.join(proj, 'certs', 'a.pem'))), 'deny');
  assert.equal(d(read(path.join(proj, '.ENV'))), 'deny');
  assert.equal(d(write(path.join(proj, '.env.production'), 'A=')), 'deny');
  assert.equal(d(read(path.join(proj, '.env.example'))), 'none');
  assert.equal(d(read(path.join(proj, 'README.md'))), 'none');
});

test('chemins Windows avec antislashs', { skip: process.platform !== 'win32' }, () => {
  const p = 'C:\\Users\\Antonio\\Desktop\\Convivia';
  assert.equal(d(read(`${p}\\.env`), { project: p }), 'deny');
  assert.equal(d(read(`${p}\\supabase\\.env.local`), { project: p }), 'deny');
  assert.equal(d(read(`${p}\\.env.example`), { project: p }), 'none');
  assert.equal(d(write(`${p}\\src\\a.ts`, 'export const a = 1;'), { project: p }), 'none');
});

test('.env.example : valeurs vides seulement', () => {
  const f = path.join(proj, '.env.example');
  assert.equal(d(write(f, '# Supabase\nNEXT_PUBLIC_SUPABASE_URL=\nSUPABASE_SERVICE_ROLE_KEY=\n\nFEDAPAY_ENV=""\n')), 'none');
  assert.equal(d(write(f, 'FEDAPAY_ENV=sandbox\n')), 'deny');
  assert.equal(d(write(f, `RESEND_API_KEY=${fake.resend()}\n`)), 'deny');
  assert.equal(d(edit(f, 'WHATSAPP_MODE=simulate')), 'deny');
  assert.equal(d(edit(f, 'WHATSAPP_MODE=')), 'none');
  assert.equal(d(write(f, 'some random text\n')), 'deny');
});

test('secrets dans le contenu écrit', () => {
  const f = path.join(proj, 'src', 'a.ts');
  const cases = [
    fake.fedapayLive(), fake.fedapaySandbox(), fake.fedapayPkLive(), fake.webhook(), fake.meta(), fake.sbSecret(), fake.resend(),
    fake.pem(), fake.jwt('service_role'),
    'const k = "' + fake.fedapayLive() + '";',
    'SUPABASE_SERVICE_ROLE' + '_KEY="abc123def"', 'FEDAPAY_WEBHOOK' + "_SECRET: 'abc123def'", 'export SCAN_CODE_ENCRYPTION' + '_KEY=abc123def456',
    '{"RESEND_API' + '_KEY": "abcdef"}', 'process.env.X = 1;\nQR_SIGNING' + '_SECRET=verysecretvalue',
  ];
  for (const c of cases) {
    assert.equal(d(write(f, c)), 'deny', c.slice(0, 20));
    assert.equal(d(edit(f, c)), 'deny', 'edit ' + c.slice(0, 20));
  }
  assert.equal(d(multiEdit(f, [{ old_string: 'a', new_string: 'ok' }, { old_string: 'b', new_string: fake.meta() }])), 'deny');
  assert.equal(d({ tool_name: 'NotebookEdit', tool_input: { notebook_path: path.join(proj, 'n.ipynb'), new_source: fake.sbSecret() } }), 'deny');
});

test('contenu légitime autorisé', () => {
  const f = path.join(proj, 'src', 'a.ts');
  const ok = [
    'const k = process.env.SUPABASE_SERVICE_ROLE_KEY;',
    'SUPABASE_SERVICE_ROLE_KEY=<your key>', 'RESEND_API' + '_KEY=', 'const NEXT_PUBLIC_SUPABASE_URL = "https://abc.supabase.co";',
    fake.jwt('anon'), 'if (process.env.FEDAPAY_SECRET_KEY === "x") {}', 'FEDAPAY_SECRET_KEY="$FEDAPAY_SECRET_KEY"',
    'Les clés commencent par sk_live_ ou sk_sandbox_ (voir TRD).', 'const re_validate_something_long_name_here = 1;',
  ];
  for (const c of ok) assert.equal(d(write(f, c)), 'none', c);
});

test('Grep sur fichiers secrets', () => {
  assert.equal(d({ tool_name: 'Grep', tool_input: { pattern: 'KEY', path: path.join(proj, '.env') } }), 'deny');
  assert.equal(d({ tool_name: 'Grep', tool_input: { pattern: 'KEY', glob: '.env*' } }), 'deny');
  assert.equal(d({ tool_name: 'Grep', tool_input: { pattern: 'KEY', path: path.join(proj, 'src') } }), 'none');
});

test('échec fermé : entrée illisible -> deny', () => {
  const r = run(S, null, { raw: 'pas du json' });
  assert.equal(r.code, 0);
  assert.equal(r.decision, 'deny');
  assert.match(r.reason, /hook en erreur/);
  assert.equal(run(S, null, { raw: '' }).decision, 'deny');
});

test('la raison ne recopie jamais le secret', () => {
  const s = fake.fedapayLive();
  const r = run(S, write(path.join(proj, 'a.ts'), `x = "${s}"`));
  assert.equal(r.decision, 'deny');
  assert.ok(!r.stdout.includes(s));
});
