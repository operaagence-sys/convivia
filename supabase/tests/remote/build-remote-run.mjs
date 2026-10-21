#!/usr/bin/env node
// Builds, from a pgTAP file of supabase/tests/database/, the SQL to paste into the Supabase MCP
// tool `execute_sql` on the STAGING project, so that the TAP output can be read WITHOUT leaving
// anything behind (the pgtap extension included).
//
// Why: execute_sql only returns the result of the last statement, and the test files end with
// `rollback;`, so running them as is shows nothing.
//
// How (the test files are NOT modified; CI keeps running them with `supabase test db`):
//  - `begin;` and `rollback;` are removed: a multi-statement query string runs in ONE implicit
//    transaction (SET LOCAL still works there);
//  - every top-level `select …` is rewritten to append its text output to a transaction-local
//    setting (`set_config('tap.out', …, true)`), which needs no privilege, even under
//    `set local role anon`;
//  - the last statement casts the collected output to integer: the error message carries the
//    whole TAP output, and the error rolls back the whole transaction (extension, rows, settings).
//
// Usage: node supabase/tests/remote/build-remote-run.mjs supabase/tests/database/00_….test.sql > out.sql
import fs from 'node:fs';

/** Splits SQL on top-level `;` (quotes, dollar quotes and comments respected). */
function splitStatements(sql) {
  const out = [];
  let cur = '';
  let i = 0;
  while (i < sql.length) {
    const c = sql[i];
    const n = sql[i + 1];
    if (c === '-' && n === '-') {
      const end = sql.indexOf('\n', i);
      const stop = end === -1 ? sql.length : end;
      cur += sql.slice(i, stop);
      i = stop;
    } else if (c === '/' && n === '*') {
      const end = sql.indexOf('*/', i + 2);
      const stop = end === -1 ? sql.length : end + 2;
      cur += sql.slice(i, stop);
      i = stop;
    } else if (c === "'" || c === '"') {
      let j = i + 1;
      while (j < sql.length) {
        if (sql[j] === c) {
          if (sql[j + 1] === c) {
            j += 2;
            continue;
          }
          break;
        }
        j++;
      }
      cur += sql.slice(i, j + 1);
      i = j + 1;
    } else if (c === '$') {
      const m = /^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/.exec(sql.slice(i, i + 80));
      if (m && !/[A-Za-z0-9_]/.test(cur[cur.length - 1] ?? '')) {
        const end = sql.indexOf(m[0], i + m[0].length);
        const stop = end === -1 ? sql.length : end + m[0].length;
        cur += sql.slice(i, stop);
        i = stop;
      } else {
        cur += c;
        i++;
      }
    } else if (c === ';') {
      out.push(cur);
      cur = '';
      i++;
    } else {
      cur += c;
      i++;
    }
  }
  if (cur.trim()) out.push(cur);
  return out;
}

const stripLeadingComments = (s) => s.replace(/^(?:\s+|--[^\n]*\n?)*/, '');

const file = process.argv[2];
if (!file) {
  console.error('usage: node build-remote-run.mjs <pgtap file>');
  process.exit(2);
}
const statements = splitStatements(fs.readFileSync(file, 'utf8'));
const lines = [
  `-- Remote pgTAP run (generated from ${file.replace(/\\/g, '/')}): rolled back by the final error.`,
];
for (const raw of statements) {
  const stmt = stripLeadingComments(raw).trim();
  if (!stmt) continue;
  if (/^(begin|rollback)$/i.test(stmt)) continue;
  if (/^select\b/i.test(stmt)) {
    lines.push(
      `select pg_catalog.set_config('tap.out', coalesce(pg_catalog.current_setting('tap.out', true), '')` +
        ` || coalesce((select pg_catalog.string_agg(t.line, E'\\n') from (${stmt}) as t(line)), '') || E'\\n', true);`,
    );
  } else {
    lines.push(`${stmt};`);
  }
}
lines.push(
  `select (E'\\n=== TAP OUTPUT ===\\n' || pg_catalog.current_setting('tap.out', true))::integer;`,
);
process.stdout.write(lines.join('\n') + '\n');
