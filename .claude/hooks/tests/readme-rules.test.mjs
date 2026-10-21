// Rules promised by the README that had no test: hook 12 (docker, cloud CLIs, gh,
// find -delete, robocopy /mir, rsync --delete), hook 8 (CLAUDE_CONFIG_DIR),
// hook 2 (DISABLE ROW LEVEL SECURITY on the command line), hook 11 (Meta pixel).
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { run, bash, write, emptyProject } from './helpers.mjs';

const d12 = (c) => run('irreversible-actions.mjs', bash(c)).decision;
const d8 = (c) => run('protect-guardrails.mjs', bash(c)).decision;
const d2 = (c) => run('guard-supabase.mjs', bash(c)).decision;
const d11 = (f, c) => run('guest-privacy.mjs', write(f, c)).decision;

/* Hook 12 ------------------------------------------------------------------ */

test('hook 12 : docker push / login et CLI cloud -> deny ; docker local -> rien', () => {
  const denied = [
    'docker push registry.example.com/convivia:latest', 'docker login', 'docker logout', 'docker --debug push img',
    'terraform apply', 'terraform apply -auto-approve', 'terraform destroy', 'terraform plan',
    'aws s3 sync . s3://bucket', 'gcloud app deploy', 'kubectl apply -f x.yaml', 'netlify deploy --prod', 'wrangler publish', 'firebase deploy',
    'flyctl deploy', 'heroku releases', 'az group delete -n x', 'helm install x y', 'pulumi up', 'serverless deploy', 'amplify push',
    'ls && terraform destroy', 'bash -c "kubectl delete pod x"', 'sudo aws sts get-caller-identity',
  ];
  for (const c of denied) assert.equal(d12(c), 'deny', c);
  const ok = [
    'docker ps', 'docker build -t convivia .', 'docker images', 'docker compose up -d', 'echo terraform apply', 'git commit -m "docker push notes"',
    'npm run aws-types', 'ls terraform/',
  ];
  for (const c of ok) assert.equal(d12(c), 'none', c);
});

test('hook 12 : gh hors lecture -> deny ; gh en lecture -> rien', () => {
  const denied = [
    'gh pr create --fill', 'gh pr merge 12', 'gh pr close 3', 'gh issue create', 'gh issue close 4', 'gh release create v1', 'gh repo delete x/y',
    'gh repo create x', 'gh workflow run ci.yml', 'gh run rerun 1', 'gh secret set X', 'gh api -X POST repos/x/y/issues', 'gh auth login', 'gh gist create a',
  ];
  for (const c of denied) assert.equal(d12(c), 'deny', c);
  const ok = [
    'gh pr view 12', 'gh pr list', 'gh pr checks', 'gh pr diff 3', 'gh issue view 4', 'gh issue list', 'gh run list', 'gh run view 1', 'gh repo view',
    'gh workflow list', 'gh release list', 'gh auth status', 'gh --version', 'gh version',
  ];
  for (const c of ok) assert.equal(d12(c), 'none', c);
});

test('hook 12 : find -delete, robocopy /mir, rsync --delete -> deny hors dossiers jetables', () => {
  const denied = [
    "find . -name '*.tmp' -delete", 'find src -type f -delete', 'find / -name x -delete', 'find . -type f -exec rm {} ;', 'find docs -delete',
    'robocopy src docs /mir', 'robocopy src docs /MIR', 'robocopy src docs /purge', 'robocopy a b /e /mir', 'robocopy src docs //MIR',
    'rsync -av --delete src/ docs/', 'rsync --delete-after a/ b/', 'rsync -a --remove-source-files src dest',
  ];
  for (const c of denied) assert.equal(d12(c), 'deny', c);
  const ok = [
    "find . -name '*.ts'", 'find src -type f -name "*.tsx"', 'find node_modules -name "*.map" -delete', 'find .next -delete',
    'robocopy src backup /e', 'robocopy src backup', 'rsync -av src/ backup/', 'rsync -av src/ /tmp/backup/', 'rsync --delete src/ dist/',
  ];
  for (const c of ok) assert.equal(d12(c), 'none', c);
});

/* Hook 8 : CLAUDE_CONFIG_DIR ------------------------------------------------ */

test('hook 8 : CLAUDE_CONFIG_DIR (change où Claude Code lit ses réglages) -> deny', () => {
  const denied = [
    'CLAUDE_CONFIG_DIR=/tmp/x claude', 'CLAUDE_CONFIG_DIR=/tmp/x npm test', 'export CLAUDE_CONFIG_DIR=/tmp/x', 'env CLAUDE_CONFIG_DIR=/tmp/x node a.js',
    'ls && CLAUDE_CONFIG_DIR=. git status', 'set CLAUDE_CONFIG_DIR=C:\\x', 'bash -c "CLAUDE_CONFIG_DIR=/tmp/x node a.js"',
    'BASH_ENV=./x.sh bash -c ls', 'LD_PRELOAD=./x.so ls',
  ];
  for (const c of denied) assert.equal(d8(c), 'deny', c);
  // sans « = » (syntaxe setx) : refusé par le hook 13
  assert.equal(run('guard-shell.mjs', bash('setx CLAUDE_CONFIG_DIR C:\\x')).decision, 'deny');
  const ok = ['git status', 'npm test', 'NODE_ENV=test npm test', 'FOO=bar node a.js', 'cat .claude/agents/pilot.md'];
  for (const c of ok) assert.equal(d8(c), 'none', c);
});

/* Hook 2 : SQL destructif en ligne de commande ------------------------------- */

test('hook 2 : DISABLE ROW LEVEL SECURITY en ligne de commande -> ask ; ENABLE -> rien', () => {
  const asks = [
    'psql -c "ALTER TABLE guests DISABLE ROW LEVEL SECURITY"', 'psql -c "alter table public.guests disable row level security;"',
    'psql -c "ALTER TABLE ONLY guests DISABLE ROW LEVEL SECURITY"', 'echo "alter table t disable row level security;" | psql',
    "psql <<EOF\nALTER TABLE t DISABLE ROW LEVEL SECURITY;\nEOF", 'psql -c "alter table t   disable   row   level   security"',
    'psql -c "ALTER TABLE t NO FORCE ROW LEVEL SECURITY; ALTER TABLE t DISABLE ROW LEVEL SECURITY"',
  ];
  for (const c of asks) assert.equal(d2(c), 'ask', c);
  const ok = ['psql -c "ALTER TABLE guests ENABLE ROW LEVEL SECURITY"', 'psql -c "alter table t force row level security"', 'git commit -m "disable row level security docs"'];
  for (const c of ok) assert.equal(d2(c), 'none', c);
});

/* Hook 11 : pixel Meta ------------------------------------------------------- */

test('hook 11 : pixel Meta refusé hors vitrine (toutes ses formes), autorisé dans la vitrine', () => {
  const proj = emptyProject();
  const snippets = [
    "fbq('init', '123');", "window.fbq('track', 'Lead');", 'fbq ("track", "PageView")', '<script src="https://connect.facebook.net/en_US/fbevents.js"></script>',
    "const s = 'fbevents.js';", "import('https://connect.facebook.net/fr_FR/sdk.js')",
  ];
  const guest = [path.join(proj, 'src', 'app', 'i', '[token]', 'page.tsx'), path.join(proj, 'src', 'components', 'shared', 'footer.tsx'), path.join(proj, 'src', 'app', 'layout.tsx')];
  const marketing = [path.join(proj, 'src', 'app', '(marketing)', 'page.tsx'), path.join(proj, 'src', 'lib', 'analytics', 'meta.ts')];
  for (const c of snippets) {
    for (const f of guest) {
      const r = run('guest-privacy.mjs', write(f, c));
      assert.equal(r.decision, 'deny', `${path.basename(f)} : ${c}`);
      assert.match(r.reason, /pixel Meta/);
    }
    for (const f of marketing) assert.equal(d11(f, c), 'none', `${path.basename(f)} : ${c}`);
  }
  // ce qui ressemble sans être le pixel : pas de faux positif
  for (const c of ['const fbqueue = 1;', 'const x = "facebook.com/convivia";', 'export const FB_PIXEL_ID = "";']) {
    assert.equal(d11(guest[0], c), 'none', c);
  }
});
