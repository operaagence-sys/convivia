import { describe, expect, it } from 'vitest';

import {
  DEFAULT_EMAIL_FROM,
  DEFAULT_EMAIL_REPLY_TO,
  EmailConfigError,
  parseEmailAllowlist,
  parseMailbox,
  resolveEmailConfig,
  resolveEmailDelivery,
} from '@/lib/email/policy';

describe('parseMailbox', () => {
  it('accepte adresse seule et « Nom <adresse> »', () => {
    expect(parseMailbox('a@convivia.app')).toEqual({
      address: 'a@convivia.app',
      domain: 'convivia.app',
    });
    expect(parseMailbox('Convivia <noreply@convivia.app>')).toEqual({
      name: 'Convivia',
      address: 'noreply@convivia.app',
      domain: 'convivia.app',
    });
  });

  it("accepte l'apostrophe, comme la saisie (parseEmail)", () => {
    expect(parseMailbox("o'brien@convivia.app")?.address).toBe("o'brien@convivia.app");
    expect(parseEmailAllowlist("O'Brien@x.fr")).toEqual(["o'brien@x.fr"]);
  });

  it.each([
    '',
    'a\r\nBcc: x@y.fr@convivia.app',
    'a<b>@convivia.app',
    'a,b@convivia.app',
    'pas une adresse',
    'a@b',
    'a@@convivia.app',
    'a b@convivia.app',
    'Nom\r\nBcc: x@y.fr <a@convivia.app>',
    'Nom "x" <a@convivia.app>',
    'a@convivia.app, b@convivia.app',
  ])('refuse %j', (raw) => {
    expect(parseMailbox(raw)).toBeUndefined();
  });
});

describe('resolveEmailConfig', () => {
  it('applique les défauts', () => {
    expect(resolveEmailConfig({ production: true, from: undefined, replyTo: undefined })).toEqual({
      from: DEFAULT_EMAIL_FROM,
      replyTo: DEFAULT_EMAIL_REPLY_TO,
    });
  });

  it('EMAIL_REPLY_TO vide = pas d’en-tête', () => {
    expect(
      resolveEmailConfig({ production: false, from: undefined, replyTo: '' }).replyTo,
    ).toBeUndefined();
  });

  it('refuse un expéditeur ou une réponse invalide', () => {
    expect(() => resolveEmailConfig({ production: false, from: 'x', replyTo: undefined })).toThrow(
      EmailConfigError,
    );
    expect(() => resolveEmailConfig({ production: false, from: undefined, replyTo: 'x' })).toThrow(
      EmailConfigError,
    );
  });

  it('refuse en production un expéditeur hors convivia.app (aussi les faux domaines)', () => {
    for (const from of [
      'Convivia <onboarding@resend.dev>',
      'a@evilconvivia.app',
      'a@convivia.app.evil.com',
    ]) {
      expect(() => resolveEmailConfig({ production: true, from, replyTo: undefined })).toThrow(
        /convivia\.app/,
      );
    }
  });

  it('accepte hors production un expéditeur de test et en production un sous-domaine', () => {
    expect(
      resolveEmailConfig({
        production: false,
        from: 'Convivia <onboarding@resend.dev>',
        replyTo: undefined,
      }).from,
    ).toBe('Convivia <onboarding@resend.dev>');
    expect(
      resolveEmailConfig({ production: true, from: 'mail@send.convivia.app', replyTo: undefined })
        .from,
    ).toBe('mail@send.convivia.app');
  });
});

describe('liste blanche et décision d’envoi', () => {
  it('normalise la liste et refuse une entrée invalide', () => {
    expect(parseEmailAllowlist(' A@x.fr, a@x.fr ,b@y.com ')).toEqual(['a@x.fr', 'b@y.com']);
    expect(parseEmailAllowlist(undefined)).toEqual([]);
    expect(parseEmailAllowlist('a@x.fr, nope')).toBeUndefined();
  });

  it('hors production: envoi seulement vers la liste, insensible à la casse', () => {
    const allowlist = ['a@x.fr'];
    expect(resolveEmailDelivery({ production: false, allowlist, to: 'A@X.fr' })).toBe('send');
    expect(resolveEmailDelivery({ production: false, allowlist, to: 'b@x.fr' })).toBe('skip');
    expect(resolveEmailDelivery({ production: false, allowlist: [], to: 'a@x.fr' })).toBe('skip');
  });

  it('en production: toujours envoyé, liste ignorée', () => {
    expect(resolveEmailDelivery({ production: true, allowlist: ['a@x.fr'], to: 'b@x.fr' })).toBe(
      'send',
    );
  });
});
