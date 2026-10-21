// Vitest launcher that normalises the working directory casing on Windows.
//
// When a tool starts us with a lower-case drive letter (`c:\...`, e.g. the Stop hook
// through `npm run`), Node ESM sees `c:/.../vitest` and `C:/.../vitest` as two modules:
// tests then fail with "Vitest failed to find the current suite". We chdir to the real
// on-disk casing, then load Vitest from that same path.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const real = fs.realpathSync.native(process.cwd());
if (real !== process.cwd()) process.chdir(real);

const entry = fs.realpathSync.native(path.join(real, 'node_modules', 'vitest', 'vitest.mjs'));
await import(pathToFileURL(entry).href);
