// Builds a fake Node project with stub Prettier / ESLint / tsc / Vitest binaries
// (not a test file). Stubs are driven by marker text in files.
import fs from 'node:fs';
import path from 'node:path';
import { tmpDir } from './helpers.mjs';

function put(dir, rel, content) {
  const f = path.join(dir, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, content);
  return f;
}

export function stubProject({ packageJson = { name: 'x', scripts: {} }, tsconfig = true } = {}) {
  const dir = tmpDir('convivia-stub-');
  if (packageJson) put(dir, 'package.json', JSON.stringify(packageJson));
  if (tsconfig) put(dir, 'tsconfig.json', '{}');
  put(dir, 'node_modules/prettier/bin/prettier.cjs', `
const fs = require('fs');
const f = process.argv[process.argv.length - 1];
const t = fs.readFileSync(f, 'utf8');
if (t.includes('PRETTIERFAIL')) { console.error('SyntaxError: boom'); process.exit(2); }
fs.writeFileSync(f, t + '\\n/* formatted */\\n');
`);
  put(dir, 'node_modules/eslint/package.json', '{"name":"eslint","version":"9.1.0"}');
  put(dir, 'node_modules/eslint/bin/eslint.js', `
const fs = require('fs');
const files = process.argv.slice(2).filter((a) => !a.startsWith('-'));
let bad = false;
for (const f of files) {
  const t = fs.readFileSync(f, 'utf8');
  if (t.includes('NOCONFIG')) { console.error("ESLint couldn't find an eslint.config.js file."); process.exit(2); }
  if (t.includes('LINTERROR')) { bad = true; for (let i = 0; i < 40; i++) console.log(f + ' line ' + i + ' error boom'); }
}
process.exit(bad ? 1 : 0);
`);
  put(dir, 'node_modules/typescript/bin/tsc', `
const fs = require('fs');
if (fs.existsSync('TSC_FAIL')) { console.log('src/a.ts(1,1): error TS2322: boom'); console.log('src/other.ts(2,2): error TS1: not mine'); process.exit(2); }
`);
  put(dir, 'node_modules/vitest/vitest.mjs', `
import fs from 'node:fs';
if (fs.existsSync('VITEST_FAIL')) { console.log('FAIL related test'); process.exit(1); }
`);
  return { dir, put: (rel, content) => put(dir, rel, content) };
}

/** Write a sub-agent transcript (JSONL) with the given tool calls. */
export function transcript(calls) {
  const dir = tmpDir('convivia-tr-');
  const lines = calls.map(([name, input], i) => JSON.stringify({
    type: 'assistant',
    message: { role: 'assistant', content: [{ type: 'text', text: 'ok' }, { type: 'tool_use', id: 't' + i, name, input }] },
  }));
  lines.splice(1, 0, '{not json');
  const f = path.join(dir, 'agent.jsonl');
  fs.writeFileSync(f, lines.join('\n') + '\n');
  return f;
}
