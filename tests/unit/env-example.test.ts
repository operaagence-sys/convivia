import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { findSecretPublicVariables } from '../../src/lib/env/guards';
import { serverEnvSchema } from '../../src/lib/env/schema';

const lines = readFileSync(path.join(process.cwd(), '.env.example'), 'utf8').split(/\r?\n/);
const assignments = lines
  .filter((line) => line.trim() !== '' && !line.trim().startsWith('#'))
  .map((line) => {
    const index = line.indexOf('=');
    return { name: line.slice(0, index), value: line.slice(index + 1) };
  });
const names = assignments.map((entry) => entry.name);

describe('.env.example', () => {
  it('ne contient aucune valeur', () => {
    const withValue = assignments.filter((entry) => entry.value !== '').map((entry) => entry.name);
    expect(withValue).toEqual([]);
  });

  it('liste chaque variable du schéma (sauf VERCEL_ENV, fournie par Vercel)', () => {
    const expected = Object.keys(serverEnvSchema.shape).filter((name) => name !== 'VERCEL_ENV');
    expect(names.slice().sort()).toEqual(expected.slice().sort());
  });

  it('ne déclare aucune variable secrète préfixée NEXT_PUBLIC_', () => {
    expect(findSecretPublicVariables(Object.fromEntries(names.map((name) => [name, ''])))).toEqual(
      [],
    );
  });

  it('ne contient aucun doublon', () => {
    expect(new Set(names).size).toBe(names.length);
  });
});
