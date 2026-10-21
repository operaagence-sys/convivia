// Repository hygiene: no secret pattern in the hooks, settings.json is coherent.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { HOOKS_DIR } from './helpers.mjs';
import { findSecrets } from '../lib/common.mjs';

const CLAUDE_DIR = path.resolve(HOOKS_DIR, '..');

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}

test('aucun motif de secret en clair dans .claude/hooks', () => {
  for (const f of walk(HOOKS_DIR)) {
    const hits = findSecrets(fs.readFileSync(f, 'utf8'));
    assert.deepEqual(hits, [], `${path.relative(HOOKS_DIR, f)} : ${hits.map((h) => `${h.kind}@${h.line}`).join(', ')}`);
  }
});

test('aucune dépendance npm : imports limités à node: et aux fichiers locaux', () => {
  for (const f of walk(HOOKS_DIR).filter((p) => p.endsWith('.mjs'))) {
    const src = fs.readFileSync(f, 'utf8');
    for (const m of src.matchAll(/^\s*import[^'"]*['"]([^'"]+)['"]/gm)) {
      assert.ok(m[1].startsWith('node:') || m[1].startsWith('.') || m[1].startsWith('file:'), `${path.basename(f)} importe ${m[1]}`);
    }
  }
});

test('settings.json : agent pilot conservé, hooks valides, scripts existants', () => {
  const file = path.join(CLAUDE_DIR, 'settings.json');
  if (!fs.existsSync(file)) return;
  const s = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(s.agent, 'pilot');
  assert.ok(s.hooks, 'bloc hooks absent');
  const events = new Set(['PreToolUse', 'PostToolUse', 'Stop', 'SubagentStop']);
  for (const [ev, groups] of Object.entries(s.hooks)) {
    assert.ok(events.has(ev), ev);
    for (const g of groups) {
      for (const h of g.hooks) {
        assert.equal(h.type, 'command');
        assert.equal(h.command, 'node');
        assert.ok(Number.isInteger(h.timeout) && h.timeout > 0 && h.timeout <= 180);
        const script = h.args[0].replace('${CLAUDE_PROJECT_DIR}', path.resolve(CLAUDE_DIR, '..'));
        assert.ok(fs.existsSync(script), script);
      }
    }
  }
  assert.ok(!JSON.stringify(s).includes('disableAllHooks'));
});
