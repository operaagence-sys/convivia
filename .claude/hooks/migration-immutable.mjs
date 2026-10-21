// Hook 10 — PreToolUse (Edit|Write|MultiEdit) on supabase/migrations/*.sql.
// Applied migrations are immutable: create a new one instead.
import fs from 'node:fs';
import path from 'node:path';
import { runHook, deny, ask, toolPath } from './lib/common.mjs';

const NAME_RE = /^\d{14}_[a-z0-9_]+\.sql$/;

runHook({ name: 'migration-immutable', event: 'PreToolUse', failMode: 'closed' }, (input, ctx) => {
  if (!['Edit', 'Write', 'MultiEdit'].includes(input.tool_name)) return undefined;
  const fp = toolPath(input.tool_input);
  if (!fp) return undefined;
  const rel = ctx.rel(fp);
  if (!/^supabase\/migrations\/[^/]+$/.test(rel)) return undefined;
  const raw = ctx.relRaw(fp);
  const base = raw.split('/').pop();
  if (!/\.sql$/i.test(base)) return undefined;

  const dir = path.join(ctx.root, 'supabase', 'migrations');
  const abs = path.join(ctx.root, raw);
  const exists = fs.existsSync(abs);
  if (!exists) {
    if (!NAME_RE.test(base)) {
      return deny(`Nom de migration invalide « ${base} » : attendu AAAAMMJJHHMMSS_nom_en_minuscules.sql (14 chiffres, puis lettres minuscules, chiffres et _). Utilise « supabase migration new <nom> » pour le générer.`);
    }
    return undefined;
  }
  let names = [];
  try {
    names = fs.readdirSync(dir).filter((n) => NAME_RE.test(n)).sort();
  } catch {
    /* fall through */
  }
  const latest = names[names.length - 1];
  if (latest && latest.toLowerCase() === base.toLowerCase()) {
    return ask(`« ${base} » est la migration la plus récente : elle a peut-être déjà été appliquée (local ou distant). Si c'est le cas, crée plutôt une nouvelle migration. Confirme seulement si elle n'a jamais été appliquée.`);
  }
  return deny(`« ${base} » est une migration existante qui n'est pas la plus récente : elle est considérée comme appliquée et ne se modifie jamais. Crée une nouvelle migration (« supabase migration new <nom> »).`);
});
