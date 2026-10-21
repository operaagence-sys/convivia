// Hook 9 — PostToolUse (Edit|Write|MultiEdit) on supabase/migrations/*.sql.
// Re-reads the whole migration and flags missing RLS / unsafe grants.
import fs from 'node:fs';
import path from 'node:path';
import { runHook, block, toolPath } from './lib/common.mjs';

/** Replace comments by spaces (offsets and line numbers preserved). */
function stripComments(sql) {
  const blank = (m) => m.replace(/[^\n]/g, ' ');
  return sql.replace(/\/\*[\s\S]*?\*\//g, blank).replace(/--[^\n]*/g, blank);
}

const lineAt = (text, idx) => text.slice(0, idx).split('\n').length;
const unq = (s) => String(s).replace(/"/g, '').toLowerCase();

/** Header + options of each CREATE FUNCTION, bodies ($$...$$) excluded. */
function functionStatements(sql) {
  const out = [];
  const re = /\bcreate\s+(?:or\s+replace\s+)?function\b/gi;
  let m;
  while ((m = re.exec(sql))) {
    const start = m.index;
    const dq = /\$([A-Za-z_]*)\$/g;
    dq.lastIndex = start;
    const semi = sql.indexOf(';', start);
    const open = dq.exec(sql);
    let header;
    let tailText = '';
    let end;
    if (open && (semi < 0 || open.index < semi)) {
      const closeIdx = sql.indexOf(open[0], open.index + open[0].length);
      header = sql.slice(start, open.index);
      if (closeIdx >= 0) {
        const after = closeIdx + open[0].length;
        const e = sql.indexOf(';', after);
        end = e < 0 ? sql.length : e;
        tailText = sql.slice(after, end);
      } else end = sql.length;
    } else {
      end = semi < 0 ? sql.length : semi;
      header = sql.slice(start, end);
    }
    out.push({ idx: start, text: `${header} ${tailText}` });
    re.lastIndex = Math.max(end, start + 1);
  }
  return out;
}

// docs/07-schema-backend.md § 14: admin views are deliberately NOT security_invoker
// (they read tables the admin role cannot read directly) but filter on the role.
const ADMIN_VIEW_NAME = /^admin_[a-z0-9_]+_v$/;
const ORGANIZER_VIEWS = new Set(['organizer_refunds_v']); // named by 07 § 8.4 / § 14, filtered by auth.uid()
const ADMIN_GUARD = /\bwhere\b[\s\S]*\b(?:private\s*\.\s*)?(?:has_admin_role|has_any_admin_role|has_permission)\s*\(/i;
const ORGANIZER_GUARD = /\bwhere\b[\s\S]*\bauth\s*\.\s*uid\s*\(\s*\)/i;
const DEFINER_MARKER = /rls-check:\s*definer-view[ \t]+\S/i;

/** 'ok' when the view is an allowed definer view, else a hint appended to the message. */
function definerViewVerdict(name, stmt, origLines, line) {
  const named = ADMIN_VIEW_NAME.test(name) ? 'admin' : ORGANIZER_VIEWS.has(name) ? 'organizer' : '';
  const hint = ' (vue admin voulue par docs/07 § 14 : nom admin_*_v, filtre WHERE private.has_admin_role / has_any_admin_role / has_permission — ou auth.uid() pour organizer_refunds_v — et commentaire « -- rls-check: definer-view <raison> » juste au-dessus)';
  if (!named) return hint;
  const marked = DEFINER_MARKER.test(`${origLines[line - 3] || ''}\n${origLines[line - 2] || ''}\n${origLines[line - 1] || ''}`);
  const guarded = (named === 'admin' ? ADMIN_GUARD : ORGANIZER_GUARD).test(stmt);
  if (marked && guarded) return 'ok';
  const missing = [];
  if (!guarded) missing.push(named === 'admin' ? 'aucun filtre WHERE par private.has_admin_role / has_any_admin_role / has_permission' : 'aucun filtre WHERE par auth.uid()');
  if (!marked) missing.push('commentaire « -- rls-check: definer-view <raison> » absent');
  return ` : ${missing.join(' ; ')}`;
}

// A justified public read: SELECT only, ONE table of public, to anon and/or authenticated, nothing else
// (no column list, no « all tables in schema », no « with grant option », no other role).
const ANON_READ_GRANT = /^grant\s+select\s+on\s+(?:table\s+)?"?public"?\s*\.\s*"?\w+"?\s+to\s+(?:"?(?:anon|authenticated)"?)(?:\s*,\s*"?(?:anon|authenticated)"?)*\s*;$/i;
const ANON_READ_MARKER = /--\s*rls-check:\s*anon-read[ \t]+\S/i;

export function analyze(original) {
  const sql = stripComments(original);
  const origLines = original.split('\n');
  const justified = (line) => /rls-check:\s*justified/i.test(`${origLines[line - 2] || ''}\n${origLines[line - 1] || ''}`);
  const issues = [];

  // 1. Tables in public without RLS
  for (const m of sql.matchAll(/\bcreate\s+(?:unlogged\s+)?table\s+(?:if\s+not\s+exists\s+)?((?:"?\w+"?\.)?"?\w+"?)/gi)) {
    const parts = m[1].split('.').map(unq);
    if (parts.length === 2 && parts[0] !== 'public') continue;
    const name = parts[parts.length - 1];
    const re = new RegExp(`\\balter\\s+table\\s+(?:only\\s+)?(?:if\\s+exists\\s+)?(?:"?public"?\\.)?"?${name}"?\\s+enable\\s+row\\s+level\\s+security\\b`, 'i');
    if (!re.test(sql)) issues.push({ line: lineAt(sql, m.index), msg: `table public.${name} créée sans « enable row level security » dans le même fichier` });
  }

  // 2. security definer without search_path
  for (const f of functionStatements(sql)) {
    if (/\bsecurity\s+definer\b/i.test(f.text) && !/\bset\s+search_path\b/i.test(f.text)) {
      issues.push({ line: lineAt(sql, f.idx), msg: 'fonction « security definer » sans « set search_path »' });
    }
  }

  // 3. grants
  for (const m of sql.matchAll(/\bgrant\b[^;]*;/gi)) {
    const stmt = m[0];
    if (/^grant\s+usage\s+on\s+schema\b/i.test(stmt) && !/\ball\b/i.test(stmt.replace(/\busage\b/i, ''))) continue;
    if (ANON_READ_GRANT.test(stmt)) {
      // « -- rls-check: anon-read <raison> » on the line above, or on the first / last line of the statement
      const first = lineAt(sql, m.index);
      const last = lineAt(sql, m.index + stmt.length - 1);
      if ([first - 1, first, last].some((n) => ANON_READ_MARKER.test(origLines[n - 1] || ''))) continue;
    }
    if (/\bto\b[^;]*\banon\b/i.test(stmt)) issues.push({ line: lineAt(sql, m.index), msg: 'grant accordé au rôle anon (accès sans connexion)' });
    else if (/^grant\s+all\b/i.test(stmt)) issues.push({ line: lineAt(sql, m.index), msg: '« grant all » trop large' });
  }

  // 4. views in public without security_invoker
  for (const m of sql.matchAll(/\bcreate\s+(?:or\s+replace\s+)?(?:(?:temp|temporary|recursive)\s+)*view\s+((?:"?\w+"?\.)?"?\w+"?)([^;]*);/gi)) {
    const parts = m[1].split('.').map(unq);
    if (parts.length === 2 && parts[0] !== 'public') continue;
    const name = parts[parts.length - 1];
    const inline = /security_invoker\s*(?:=\s*)?(?:true|on|1)\b/i.test(m[2]);
    const later = new RegExp(`\\balter\\s+view\\s+(?:if\\s+exists\\s+)?(?:"?public"?\\.)?"?${name}"?\\s+set\\s*\\([^)]*security_invoker\\s*(?:=\\s*)?(?:true|on|1)`, 'i').test(sql);
    if (inline || later) continue;
    const line = lineAt(sql, m.index);
    const verdict = definerViewVerdict(name, m[0], origLines, line);
    if (verdict !== 'ok') issues.push({ line, msg: `vue public.${name} sans « security_invoker = true »${verdict}` });
  }

  // 5. permissive policies
  for (const m of sql.matchAll(/\bcreate\s+policy\b[^;]*;/gi)) {
    if (/\busing\s*\(\s*true\s*\)|\bwith\s+check\s*\(\s*true\s*\)/i.test(m[0])) {
      const line = lineAt(sql, m.index);
      if (!justified(line)) {
        issues.push({ line, msg: 'politique avec « using (true) » / « with check (true) » : à justifier (commentaire « -- rls-check: justified <raison> » juste au-dessus)' });
      }
    }
  }

  // 6. RLS disabled
  for (const m of sql.matchAll(/\bdisable\s+row\s+level\s+security\b/gi)) {
    issues.push({ line: lineAt(sql, m.index), msg: '« disable row level security »' });
  }
  return issues;
}

runHook({ name: 'rls-check', event: 'PostToolUse', failMode: 'closed' }, (input, ctx) => {
  const fp = toolPath(input.tool_input);
  if (!fp) return undefined;
  const rel = ctx.rel(fp);
  if (!/^supabase\/migrations\/[^/]+\.sql$/.test(rel)) return undefined;
  const abs = path.join(ctx.root, ctx.relRaw(fp));
  if (!fs.existsSync(abs)) return undefined;
  const issues = analyze(fs.readFileSync(abs, 'utf8'));
  if (!issues.length) return undefined;
  const list = issues.map((i) => `- ligne ${i.line} : ${i.msg}`).join('\n');
  return block(`Contrôle RLS de ${ctx.relRaw(fp)} (docs/07-schema-backend.md § 1 : accès refusé par défaut) :\n${list}\nCorrige la migration (ou justifie explicitement) avant de continuer.`);
});
