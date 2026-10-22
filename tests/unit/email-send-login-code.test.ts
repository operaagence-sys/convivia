import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EmailSendError, sendLoginCodeEmail } from '@/lib/email';
import { PRODUCTION_REQUIRED_ENV } from '@/lib/env/guards';
import { resetServerEnvCache } from '@/lib/env/server';

const fetchMock = vi.fn();
const RECIPIENT = 'invite@example.com';
const API_KEY = 're_fake_key_for_tests';
const FILLER = 'f'.repeat(40);

function stubDevEnv(extra: Record<string, string> = {}): void {
  vi.stubEnv('VERCEL_ENV', 'preview');
  vi.stubEnv('RESEND_API_KEY', API_KEY);
  vi.stubEnv('EMAIL_FROM', 'Convivia <onboarding@resend.dev>');
  vi.stubEnv('EMAIL_TEST_ALLOWLIST', RECIPIENT);
  for (const [name, value] of Object.entries(extra)) vi.stubEnv(name, value);
  resetServerEnvCache();
}

/** Production complète et valide (valeurs factices), pour tester la liste blanche ignorée. */
function productionVars(): Record<string, string> {
  const vars: Record<string, string> = {
    VERCEL_ENV: 'production',
    WHATSAPP_MODE: 'live',
    FEDAPAY_ENV: 'live',
    EMAIL_FROM: 'Convivia <noreply@convivia.app>',
  };
  for (const name of PRODUCTION_REQUIRED_ENV) {
    if (name === 'NEXT_PUBLIC_SITE_URL') vars[name] = 'https://convivia.app';
    else if (name === 'NEXT_PUBLIC_SUPABASE_URL') vars[name] = 'https://ref.supabase.co';
    else if (name === 'SUPABASE_SECRET_KEY') vars[name] = `sb_secret_${FILLER}`;
    else if (name.startsWith('LOGIN_')) vars[name] = `${name}-${FILLER}`;
    else vars[name] = FILLER;
  }
  vars.RESEND_API_KEY = API_KEY;
  return vars;
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  resetServerEnvCache();
});

describe('sendLoginCodeEmail', () => {
  it('appelle Resend avec clé d’idempotence, expéditeur, réponse et textes français', async () => {
    stubDevEnv();
    fetchMock.mockResolvedValue(new Response('{}', { status: 200 }));
    await sendLoginCodeEmail({ to: RECIPIENT, code: '123456' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.resend.com/emails');
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Bearer ${API_KEY}`);
    expect(headers['Idempotency-Key']).toMatch(/^[0-9a-f-]{36}$/);
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body.from).toBe('Convivia <onboarding@resend.dev>');
    expect(body.to).toEqual([RECIPIENT]);
    expect(body.reply_to).toBe('support@convivia.app');
    expect(body.subject).toBe('Votre code Convivia : 123456');
    expect(String(body.text)).toContain('10 minutes');
  });

  it('EMAIL_REPLY_TO vide: aucun reply_to', async () => {
    stubDevEnv({ EMAIL_REPLY_TO: '' });
    fetchMock.mockResolvedValue(new Response('{}', { status: 200 }));
    await sendLoginCodeEmail({ to: RECIPIENT, code: '123456' });
    const body = JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string);
    expect(body).not.toHaveProperty('reply_to');
  });

  it('hors production, adresse hors liste: rien n’est envoyé et aucune erreur', async () => {
    stubDevEnv();
    await expect(
      sendLoginCodeEmail({ to: 'autre@example.com', code: '123456' }),
    ).resolves.toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('hors production, liste vide: rien n’est envoyé', async () => {
    stubDevEnv({ EMAIL_TEST_ALLOWLIST: '' });
    await sendLoginCodeEmail({ to: RECIPIENT, code: '123456' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('en production, la liste blanche est ignorée', async () => {
    stubDevEnv(productionVars());
    fetchMock.mockResolvedValue(new Response('{}', { status: 200 }));
    await sendLoginCodeEmail({ to: 'autre@example.com', code: '123456' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('en production, un expéditeur hors convivia.app est refusé au démarrage', async () => {
    stubDevEnv({ ...productionVars(), EMAIL_FROM: 'Convivia <onboarding@resend.dev>' });
    await expect(sendLoginCodeEmail({ to: RECIPIENT, code: '123456' })).rejects.toThrow(
      /convivia\.app/,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('erreur Resend: message fixe, sans adresse, code ni corps de réponse', async () => {
    stubDevEnv();
    fetchMock.mockResolvedValue(
      new Response(`{"message":"bad ${RECIPIENT} 123456 ${API_KEY}"}`, { status: 422 }),
    );
    const error = await sendLoginCodeEmail({ to: RECIPIENT, code: '123456' }).catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(EmailSendError);
    const text = JSON.stringify({ message: (error as Error).message, ...(error as object) });
    for (const secret of [RECIPIENT, '123456', API_KEY, 'bad']) expect(text).not.toContain(secret);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('erreur réseau puis succès: une nouvelle tentative avec la même clé d’idempotence', async () => {
    stubDevEnv();
    fetchMock
      .mockRejectedValueOnce(new Error(`reset ${RECIPIENT}`))
      .mockResolvedValueOnce(new Response('{}', { status: 200 }));
    await sendLoginCodeEmail({ to: RECIPIENT, code: '123456' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const keys = fetchMock.mock.calls.map(
      (call) => ((call[1] as RequestInit).headers as Record<string, string>)['Idempotency-Key'],
    );
    expect(keys[0]).toBe(keys[1]);
  });

  it('échec persistant (500 deux fois): lève sans fuite', async () => {
    stubDevEnv();
    fetchMock.mockResolvedValue(new Response('boom', { status: 500 }));
    const error = (await sendLoginCodeEmail({ to: RECIPIENT, code: '123456' }).catch(
      (e: unknown) => e,
    )) as EmailSendError;
    expect(error).toBeInstanceOf(EmailSendError);
    expect(error.reason).toBe('unavailable');
    expect(error.message).not.toContain(RECIPIENT);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('clé Resend absente: erreur de configuration, aucun appel', async () => {
    stubDevEnv({ RESEND_API_KEY: '' });
    await expect(sendLoginCodeEmail({ to: RECIPIENT, code: '123456' })).rejects.toMatchObject({
      reason: 'config',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('destinataire ou code invalide: erreur sans valeur', async () => {
    stubDevEnv();
    await expect(
      sendLoginCodeEmail({ to: 'pas-une-adresse', code: '123456' }),
    ).rejects.toBeInstanceOf(EmailSendError);
    const error = (await sendLoginCodeEmail({ to: RECIPIENT, code: 'abcdef' }).catch(
      (e: unknown) => e,
    )) as EmailSendError;
    expect(error.message).not.toContain('abcdef');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
