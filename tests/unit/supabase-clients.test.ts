import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createServiceRoleClient } from '@/lib/supabase/admin';
import { config as proxyConfig, proxy } from '@/proxy';
import { resetServerEnvCache } from '@/lib/env/server';

const root = path.resolve(import.meta.dirname, '../../src');
const read = (file: string) => readFileSync(path.join(root, file), 'utf8');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(name) && !/\.test\./.test(name) ? [full] : [];
  });
}

afterEach(() => resetServerEnvCache());

describe('isolation du client service_role', () => {
  it('les modules serveur importent server-only', () => {
    for (const file of ['admin.ts', 'server.ts', 'anon.ts']) {
      expect(read(`lib/supabase/${file}`)).toMatch(/^import 'server-only';/m);
    }
  });

  it('aucun fichier "use client" n’importe un module serveur Supabase ni lib/env/server', () => {
    const forbidden = /from '@\/lib\/(supabase\/(admin|server|anon)|env\/server)'/;
    const offenders = sourceFiles(root).filter((file) => {
      const text = readFileSync(file, 'utf8');
      return /^['"]use client['"]/m.test(text) && forbidden.test(text);
    });
    expect(offenders).toEqual([]);
  });

  it('le proxy ne référencent pas la clé service_role', () => {
    for (const file of ['lib/supabase/session.ts', 'proxy.ts']) {
      expect(read(file)).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY|supabase\/admin/);
    }
  });
});

describe('variables manquantes', () => {
  it('le client service_role refuse de démarrer sans sa clé', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
    expect(() => createServiceRoleClient()).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
  });

  it('le client service_role se crée quand tout est présent', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'fake-service-role-for-test');
    expect(() => createServiceRoleClient()).not.toThrow();
  });
});

describe('proxy (rafraîchissement de session)', () => {
  // Le matcher de Next.js est une expression de chemin; ses parenthèses sont des regex.
  const matcher = new RegExp(`^${proxyConfig.matcher[0]}$`);

  it.each(['/i/abc123', '/i', '/i/abc/', '/og/event/1.png', '/_next/static/x.js', '/robots.txt'])(
    'le matcher exclut %s',
    (p) => expect(matcher.test(p)).toBe(false),
  );

  it.each(['/', '/login', '/dashboard', '/events/1/guests', '/scan', '/admin', '/invitation'])(
    'le matcher couvre %s',
    (p) => expect(matcher.test(p)).toBe(true),
  );

  it('sur /i/*, ne pose aucun cookie et ne lit pas les variables Supabase', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
    const request = new NextRequest('https://convivia.test/i/abc', {
      headers: { cookie: 'sb-ref-auth-token=x' },
    });
    const response = await proxy(request);
    expect(response.cookies.getAll()).toEqual([]);
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it('sans cookie de session, laisse passer sans appel réseau', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-test');
    const response = await proxy(new NextRequest('https://convivia.test/'));
    expect(response.status).toBe(200);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
