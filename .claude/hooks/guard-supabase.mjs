// Hook 2 — PreToolUse (Bash|PowerShell|Monitor + MCP Supabase).
//  - DENY: anything that reaches a REMOTE Supabase project from the shell (--linked, --db-url,
//    push/pull, link, secrets, deploy, remote psql, Supabase HTTP APIs) and every Supabase MCP
//    tool except search_docs, a short read-only allowlist and execute_sql, all limited to ONE
//    project, the STAGING (see ALLOWED_SUPABASE_PROJECT_ID).
//  - ALLOW on staging: execute_sql (pgTAP rolled back, read queries). ASK on destructive / sensitive SQL.
//  - DENY apply_migration, always (decision 2026-10-21): only the project owner applies migrations
//    to the staging, with the Supabase CLI `db push`. Agents write the files in supabase/migrations/.
//  - Production is another project: it is never added to the allowlist.
// Local development (`supabase db reset|test db|start|stop` against the local
// stack) is NOT questioned: it is the normal workflow of the supabase-developer.
import { runHook, ask, deny, isShellTool, shellCommand } from './lib/common.mjs';
import { allSegments, commandOf } from './lib/shell.mjs';

/**
 * Replaces SQL comments (-- and nested block comments) by a space. Quoted text ('…', E'…',
 * "…", $tag$…$tag$) is kept as is (so that it is still scanned: conservative) but a comment
 * marker inside it is NOT a comment, which prevents « select '--'; drop table x » from
 * hiding the DROP. Unterminated quote = the rest of the text stays opaque.
 */
export function stripSqlComments(sql) {
  const s = String(sql ?? '');
  let out = '';
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    const n = s[i + 1];
    if (c === '-' && n === '-') {
      while (i < s.length && s[i] !== '\n') i++;
      out += ' ';
    } else if (c === '/' && n === '*') {
      let depth = 1;
      i += 2;
      while (i < s.length && depth > 0) {
        if (s[i] === '/' && s[i + 1] === '*') { depth++; i += 2; } else if (s[i] === '*' && s[i + 1] === '/') { depth--; i += 2; } else i++;
      }
      out += ' ';
    } else if (c === "'" || c === '"') {
      const escapes = c === "'" && /(?:^|[^A-Za-z0-9_$])[eE]$/.test(out); // E'…' accepts \'
      let j = i + 1;
      while (j < s.length) {
        if (escapes && s[j] === '\\') { j += 2; continue; }
        if (s[j] === c) {
          if (s[j + 1] === c) { j += 2; continue; }
          break;
        }
        j++;
      }
      out += s.slice(i, j + 1);
      i = j + 1;
    } else if (c === '$') {
      const m = /^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/.exec(s.slice(i, i + 80));
      const prev = out[out.length - 1];
      if (m && !(prev && /[A-Za-z0-9_]/.test(prev))) {
        const end = s.indexOf(m[0], i + m[0].length);
        const stop = end === -1 ? s.length : end + m[0].length;
        out += s.slice(i, stop);
        i = stop;
      } else {
        out += c;
        i++;
      }
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

/**
 * True if a statement (already split on « ; ») runs or may run a TRUNCATE. Protective forms are
 * NOT truncations: « create trigger … before truncate on … execute function … », « revoke …
 * truncate … from … » and « comment on … ». A revoke whose privilege list is followed by a
 * table name (« revoke … truncate public.t ») is not accepted as protective.
 */
function hasRealTruncate(stmt) {
  if (!/\btruncate\b/i.test(stmt)) return false;
  if (/^\s*create\s+(?:or\s+replace\s+)?(?:constraint\s+)?trigger\b/i.test(stmt)) return false;
  if (/^\s*comment\s+on\b/i.test(stmt)) return false;
  if (/^\s*revoke\b/i.test(stmt) && !/\btruncate\s+(?!on\b|,)/i.test(stmt)) return false;
  return true;
}

/** Destructive SQL patterns. Returns the list of matched labels. */
export function destructiveSql(sql) {
  const text = stripSqlComments(sql);
  const labels = [];
  const m = /\bdrop\s+(?:materialized\s+)?([a-z]+)\b/i.exec(text);
  if (m) labels.push(`DROP ${m[1].toUpperCase()}`);
  if (text.split(';').some(hasRealTruncate)) labels.push('TRUNCATE');
  for (const stmt of text.split(';')) {
    if (!/\bdelete\s+from\b/i.test(stmt)) continue;
    if (!/\bwhere\b/i.test(stmt)) {
      labels.push('DELETE FROM sans WHERE');
      break;
    }
    // WHERE true / WHERE 1=1 deletes everything as well
    if (/\bwhere\s+\(?\s*(?:true|1\s*=\s*1)\s*\)?\s*(?:returning\b[\s\S]*)?["'\s]*$/i.test(stmt.trim())) {
      labels.push('DELETE FROM … WHERE true / 1=1');
      break;
    }
  }
  if (/\balter\s+table\b[^;]*\bdrop\b/i.test(text)) labels.push('ALTER TABLE … DROP');
  if (/\bdisable\s+row\s+level\s+security\b/i.test(text)) labels.push('DISABLE ROW LEVEL SECURITY');
  return labels;
}

// Schemas managed by the platform: writing there is questioned.
const PROT = '(?:auth|storage|vault|cron|realtime|extensions|pgsodium|net|graphql|graphql_public|pgbouncer|supabase_[a-z0-9_]+)';
const PREF = `"?${PROT}"?\\s*\\.`; // schema-qualified reference
const RE = {
  write: new RegExp(`\\b(?:insert\\s+into|update|delete\\s+from|truncate(?:\\s+table)?|merge\\s+into|copy)\\s+(?:only\\s+)?(?:\\(\\s*)?${PREF}`, 'i'),
  alterLike: /^\s*(?:alter|drop|grant|revoke|comment|reassign|security)\b/i,
  createName: new RegExp(`\\bcreate\\s+(?:or\\s+replace\\s+)?(?:(?:unique|temp|temporary|unlogged|materialized|recursive|constraint|event)\\s+)*(?:table|view|function|procedure|type|sequence|domain)\\s+(?:if\\s+not\\s+exists\\s+)?${PREF}`, 'i'),
  createSchema: new RegExp(`\\bcreate\\s+schema\\s+(?:if\\s+not\\s+exists\\s+)?"?${PROT}"?(?![A-Za-z0-9_])`, 'i'),
  createOn: new RegExp(`^\\s*create\\b[^;]*\\bon\\s+(?:only\\s+)?${PREF}`, 'i'),
  pref: new RegExp(`(?<![\\w.$"])${PREF}`, 'i'),
  fkRef: new RegExp(`\\breferences\\s+${PREF}\\s*"?\\w+"?`, 'gi'),
  cronOk: /\bcron\s*\.\s*(?:schedule|unschedule)\s*\(/gi,
  cronOther: /\bcron\s*\.\s*(?:alter_job|schedule_in_database)\b/i,
  vault: /(?<![\w.$"])"?vault"?\s*\./i,
};

/**
 * Everything that must be confirmed before SQL runs on the staging project (execute_sql and
 * apply_migration). Superset of destructiveSql(). Textual analysis: see the README for limits.
 */
export function sqlRisks(sql) {
  const labels = [...destructiveSql(sql)];
  const text = stripSqlComments(sql);
  const add = (l) => { if (!labels.includes(l)) labels.push(l); };
  for (const raw of text.split(';')) {
    // the three allowed pg_cron functions and FK references to auth.* are normal in migrations
    const stmt = raw.replace(RE.cronOk, ' ').replace(RE.fkRef, ' ');
    if (RE.write.test(stmt)) add('écriture dans un schéma géré par la plateforme (auth, storage, vault, cron, supabase_*…)');
    else if (RE.alterLike.test(stmt) && RE.pref.test(stmt)) add('ALTER/DROP/GRANT/REVOKE sur un schéma géré par la plateforme (auth, storage, vault, cron, supabase_*…)');
    else if (RE.createName.test(stmt) || RE.createSchema.test(stmt) || RE.createOn.test(stmt)) add('CREATE dans (ou sur un objet de) un schéma géré par la plateforme (auth, storage, vault, cron, supabase_*…)');
    if (RE.cronOther.test(stmt)) add('cron.alter_job / cron.schedule_in_database');
    if (RE.vault.test(stmt)) add('accès au schéma vault (secrets)');
    if (/\b(?:alter|create)\s+(?:role|user|group)\b/i.test(stmt)) add('ALTER/CREATE ROLE');
    if (/\balter\s+default\s+privileges\b/i.test(stmt)) add('ALTER DEFAULT PRIVILEGES');
    if (/^\s*grant\b[\s\S]*\ball\s+(?:tables|functions|sequences|routines|procedures)\s+in\s+schema\b[\s\S]*\bto\b[\s\S]*\b(?:anon|authenticated|public)\b/i.test(stmt)) add('GRANT sur tout un schéma à anon / authenticated / public');
    if (/\bcreate\s+extension\b/i.test(stmt)) add('CREATE EXTENSION');
    if (/\balter\s+system\b|\bset\s+(?:session\s+authorization|(?:local\s+|session\s+)?role)\b/i.test(stmt)) add('ALTER SYSTEM / SET ROLE');
    if (/\bdo\s+(?:language\s+\w+\s+)?(?:\$|')/i.test(stmt) || /\bexecute\s+(?!function\b|procedure\b|on\b|,)/i.test(stmt)) add('SQL dynamique (DO / EXECUTE) : contenu non analysable');
    if (/\bcopy\b[\s\S]*\b(?:program|from\s+'|to\s+')|\b(?:pg_read_file|pg_read_binary_file|pg_ls_dir|lo_import|lo_export|dblink\w*)\b/i.test(stmt)) add('accès fichier / programme / base externe');
  }
  return labels;
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

/** True if a connection string points to this machine only. Unparsable = not local. */
export function isLocalUrl(url) {
  const m = /^[a-z][a-z0-9+.-]*:\/\/(?:[^@/?#]*@)?(\[[^\]]+\]|[^:/?#]+)/i.exec(String(url).trim());
  return !!m && LOCAL_HOSTS.has(m[1].toLowerCase());
}

/** Values given to SUPABASE_DB_URL / DATABASE_URL in the command text or the hook environment. */
function dbUrlValues(command) {
  const out = [];
  for (const m of command.matchAll(/\b(SUPABASE_DB_URL|DATABASE_URL)["']?\s*=\s*["']?([^\s"';&|]*)/gi)) out.push([m[1].toUpperCase(), m[2]]);
  for (const k of ['SUPABASE_DB_URL', 'DATABASE_URL']) if (process.env[k]) out.push([k, process.env[k]]);
  return out;
}

const isRemoteFlag = (x) => x === '--linked' || x === '--db-url' || x.startsWith('--db-url=') || x === '--project-ref' || x.startsWith('--project-ref=') || x === '--project-id' || x.startsWith('--project-id=');
// Sub-commands that only exist to act on the remote platform.
const REMOTE_ROOTS = new Set(['link', 'unlink', 'login', 'logout', 'projects', 'orgs', 'branches', 'secrets', 'domains', 'vanity-subdomains', 'sso', 'network-bans', 'network-restrictions', 'ssl-enforcement', 'postgres-config', 'backups', 'snippets', 'encryption', 'inspect', 'config', 'seed']);
// Local-stack workflow (reviewed list: anything else is refused, new CLI commands included).
// null = no sub-command restriction.
const LOCAL_SUBS = {
  init: null, start: null, stop: null, status: null, help: null, version: null, completion: null, services: null,
  test: ['db', 'new'],
  db: ['reset', 'lint', 'diff', 'test', 'start'],
  migration: ['new', 'up', 'down', 'list', 'squash'],
  gen: ['types'],
  functions: ['serve', 'new'],
};

function checkSupabaseCli(args, remoteEnv) {
  const a = args.map((x) => x.toLowerCase());
  const denies = [];
  const asks = [];
  const sub = a.filter((x) => !x.startsWith('-'));
  const local = a.includes('--local');
  if (a.some(isRemoteFlag)) denies.push('la commande vise une base distante (--linked / --db-url / --project-ref / --project-id)');
  if (remoteEnv && !['status', 'help', 'version', 'completion', 'init'].includes(sub[0])) denies.push(`${remoteEnv} pointe hors de localhost / 127.0.0.1 : la commande pourrait viser une base distante`);
  if (REMOTE_ROOTS.has(sub[0])) denies.push(`« supabase ${sub[0]} » agit sur la plateforme distante`);
  else if (sub[0] && !(sub[0] in LOCAL_SUBS)) denies.push(`« supabase ${sub[0]} » n'est pas dans la liste des commandes locales revues`);
  else if (sub[0] && LOCAL_SUBS[sub[0]] && sub[1] && !LOCAL_SUBS[sub[0]].includes(sub[1])) {
    denies.push(`« supabase ${sub[0]} ${sub[1]} » agit sur la base ou le projet distant (ou n'est pas une commande locale revue)`);
  }
  if (sub[0] === 'migration' && sub[1] === 'list' && !local) denies.push('« supabase migration list » sans --local lit la base liée');
  if (sub[0] === 'migration' && sub[1] === 'squash') asks.push("« supabase migration squash » réécrit l'historique des migrations");
  if (sub[0] === 'stop' && a.includes('--no-backup')) asks.push('« supabase stop --no-backup » supprime les données locales');
  return { denies, asks };
}

const HTTP_PROGS = new Set(['curl', 'wget', 'http', 'https', 'httpie', 'xh', 'node', 'nodejs', 'python', 'python3', 'py', 'deno', 'bun', 'ruby', 'perl', 'php', 'nc', 'ncat', 'telnet']);
const SUPABASE_REMOTE = /(?:^|[^a-z0-9-])(?:[a-z0-9]{12,}\.supabase\.(?:co|com|in)|api\.supabase\.com)(?![a-z0-9-])/i;
const PG_PROGS = new Set(['psql', 'pg_restore', 'pg_dump', 'pg_dumpall', 'pgcli', 'createdb', 'dropdb', 'createuser', 'dropuser']);

/** Hosts given to a Postgres client: -h/--host, a URL, host= in a conninfo string, PGHOST. None = local socket. */
function pgHosts(args, assigns) {
  const hosts = [];
  for (let i = 0; i < args.length; i++) {
    const x = args[i];
    if (x === '-h' || x === '--host') hosts.push(args[i + 1] || '');
    else if (/^--host=/.test(x)) hosts.push(x.slice(7));
    else if (/^-h./.test(x)) hosts.push(x.slice(2));
    for (const m of x.matchAll(/\b(?:postgres(?:ql)?|pgsql):\/\/(?:[^@/?#\s]*@)?(\[[^\]]+\]|[^:/?#\s]+)/gi)) hosts.push(m[1]);
    for (const m of x.matchAll(/\bhost\s*=\s*['"]?([^\s'"]+)/gi)) hosts.push(m[1]);
  }
  for (const a of assigns) {
    const m = /^PGHOST=(.*)$/i.exec(a);
    if (m) hosts.push(m[1]);
  }
  if (process.env.PGHOST) hosts.push(process.env.PGHOST);
  return hosts;
}
const isLocalHost = (h) => !h || LOCAL_HOSTS.has(String(h).toLowerCase()) || String(h).startsWith('/');

function checkBash(rawCommand) {
  // `\` + newline is a line continuation: join before any analysis.
  const command = String(rawCommand).replace(/\\\r?\n/g, ' ');
  const denies = [];
  const asks = [];
  let usesSql = false;
  const remote = dbUrlValues(command).find(([, v]) => v && !isLocalUrl(v));
  const remoteEnv = remote ? remote[0] : '';
  for (const seg of allSegments(command)) {
    const c = commandOf(seg.words);
    if (!c) continue;
    if (c.prog === 'supabase') {
      const r = checkSupabaseCli(c.args, remoteEnv);
      denies.push(...r.denies);
      asks.push(...r.asks);
      usesSql = true;
    } else if (PG_PROGS.has(c.prog)) {
      usesSql = true;
      const bad = pgHosts(c.args, c.assigns).filter((h) => !isLocalHost(h));
      if (bad.length) denies.push(`« ${c.prog} » vise un serveur Postgres distant (${String(bad[0]).replace(/[^A-Za-z0-9.\-:[\]_]/g, '').slice(0, 60)})`);
      if (c.prog === 'pg_restore' && c.args.some((x) => x === '--clean' || x === '-c' || x === '--create')) asks.push('pg_restore --clean supprime des objets existants');
      if ((c.prog === 'pg_dump' || c.prog === 'pg_dumpall') && c.args.some((x) => x === '--clean' || /^-[A-Za-z]*c[A-Za-z]*$/.test(x))) asks.push('pg_dump --clean ajoute des DROP dans le script');
    }
    if (HTTP_PROGS.has(c.prog) && SUPABASE_REMOTE.test(c.args.join(' '))) denies.push('appel direct à une API Supabase distante (*.supabase.co / api.supabase.com)');
  }
  if (usesSql) {
    // whole command: covers heredocs and « echo 'DROP …' | psql »
    const sql = destructiveSql(command);
    if (sql.length) asks.push(`SQL destructif (${sql.join(', ')})`);
  }
  return { denies: [...new Set(denies)], asks: [...new Set(asks)] };
}

/**
 * The ONLY remote Supabase project an agent may use: the STAGING project « conviva »
 * (decision of the project owner). The production project is another project, created in
 * tranche 16, and must NEVER be added here. Single constant, sealed by seal.mjs with this
 * file. Never read from an environment variable (an agent could change it).
 */
export const ALLOWED_SUPABASE_PROJECT_ID = 'rvlfxpafjrnmhfxsgayd';

/** Documentation search: allowed without any project. */
const MCP_NO_PROJECT = new Set(['search_docs']);
/**
 * Tools allowed on ALLOWED_SUPABASE_PROJECT_ID only (allowlist: any other tool, known or not,
 * is refused). Value = name of the argument that carries the project id.
 * Deliberately absent: get_logs (may hold personal data), deploy_edge_function, every
 * create/delete/merge/reset/rebase/pause/restore, list_projects, list_organizations,
 * get_organization, get_cost, confirm_cost, keys/secrets.
 */
const MCP_READ_ON_PROJECT = new Map([
  ['list_tables', 'project_id'], ['list_extensions', 'project_id'], ['list_migrations', 'project_id'],
  ['get_advisors', 'project_id'], ['get_project', 'id'], ['get_project_url', 'project_id'],
  ['list_edge_functions', 'project_id'], ['get_edge_function', 'project_id'], ['generate_typescript_types', 'project_id'],
]);
/** SQL tool on the staging project, with SQL guard-rails (see sqlRisks). apply_migration is refused (see checkMcp). */
const MCP_SQL_ON_PROJECT = new Set(['execute_sql']);

// apply_migration is always refused (decision of the project owner, 2026-10-21): only the owner
// applies migrations to the staging, with the Supabase CLI from his own terminal.
const APPLY_MIGRATION_DENIED = 'Les migrations sont appliquées au staging par le porteur du projet avec `supabase db push`. Écris le fichier dans supabase/migrations/ et signale-le dans ton rapport.';

function checkMcp(op, toolInput) {
  if (op === 'apply_migration') return deny(APPLY_MIGRATION_DENIED);
  if (MCP_NO_PROJECT.has(op)) return undefined;
  const sqlTool = MCP_SQL_ON_PROJECT.has(op);
  const field = MCP_READ_ON_PROJECT.get(op) ?? (sqlTool ? 'project_id' : undefined);
  if (field) {
    const ti = toolInput && typeof toolInput === 'object' ? toolInput : {};
    // exact match only: no trim, no case folding. get_project names its argument « id »;
    // if project_id is also given, it must match too.
    const given = [ti[field], ...(field !== 'project_id' && 'project_id' in ti ? [ti.project_id] : [])];
    if (!given.every((v) => typeof v === 'string' && v === ALLOWED_SUPABASE_PROJECT_ID)) {
      return deny(`Outil MCP Supabase « ${op} » refusé : project_id absent, mal formé ou différent du seul projet autorisé (le projet staging). Aucun autre projet Supabase (production comprise) ne peut être utilisé par un agent.`);
    }
    if (!sqlTool) return undefined;
    if (typeof ti.query !== 'string' || !ti.query.trim()) return deny(`« ${op} » refusé : le SQL (query) est absent ou vide.`);
    const risks = sqlRisks(ti.query);
    if (risks.length) return ask(`SQL sensible sur le projet staging via « ${op} » : ${risks.join(' ; ')}. Confirme avant de poursuivre.`);
    return undefined;
  }
  return deny(`Outil MCP Supabase « ${op} » refusé : seuls search_docs, quelques outils de lecture (${[...MCP_READ_ON_PROJECT.keys()].join(', ')}) et execute_sql sur le projet staging sont permis. Pas de journaux, de déploiement, de branche, de migration ni de gestion de projet : le porteur du projet fait ces opérations lui-même.`);
}

runHook({ name: 'guard-supabase', event: 'PreToolUse', failMode: 'closed' }, (input) => {
  const tool = String(input.tool_name || '');
  if (/^mcp__.*supabase/i.test(tool)) return checkMcp(tool.split('__').pop(), input.tool_input);
  if (!isShellTool(tool)) return undefined;
  const r = checkBash(shellCommand(input));
  if (r.denies.length) {
    return deny(`Opération Supabase distante refusée : ${r.denies.join(' ; ')}. La CLI ne vise jamais une base distante depuis un agent : seul le porteur du projet la lance, dans son propre terminal (\`supabase db push\` pour appliquer les migrations au staging). Écris le fichier dans supabase/migrations/ et signale-le dans ton rapport ; pour lire ou tester le staging, utilise les outils MCP de lecture et execute_sql.`);
  }
  if (r.asks.length) return ask(`Opération Supabase sensible : ${r.asks.join(' ; ')}. Confirme avant de poursuivre.`);
  return undefined;
});
