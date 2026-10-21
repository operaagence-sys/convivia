import { describe, expect, it } from 'vitest';
import { maskPhone, scrubBreadcrumb, scrubEvent, scrubString, scrubUrl } from './scrub';

describe('maskPhone', () => {
  it('masque au format du TRD 12.2', () => {
    expect(maskPhone('+22997123412')).toBe('+229 •• •• •• 12');
    expect(maskPhone('+229 97 12 34 12')).toBe('+229 •• •• •• 12');
    expect(maskPhone('+225 07 12 34 56 78')).toBe('+225 •• •• •• 78');
  });

  it('masque sans indicatif connu', () => {
    expect(maskPhone('+33612345678')).toBe('•• •• •• 78');
    expect(maskPhone('0197123412')).toBe('•• •• •• 12');
  });
});

describe('scrubUrl', () => {
  it('remplace le jeton d’invitation et retire requête et fragment', () => {
    expect(scrubUrl('https://convivia.test/i/AbCdEfGhIjKlMnOpQrStUv?x=1#top')).toBe(
      'https://convivia.test/i/[token]',
    );
    expect(scrubUrl('/i/AbCdEfGhIjKlMnOpQrStUv/qr')).toBe('/i/[token]/qr');
  });

  it('laisse les autres URL lisibles', () => {
    expect(scrubUrl('https://convivia.test/events/42?tab=guests')).toBe(
      'https://convivia.test/events/42',
    );
  });
});

describe('scrubString', () => {
  it('masque numéros, e-mails et jetons dans un texte libre', () => {
    const text =
      'Échec pour +22997123412 (awa@example.com) sur /i/AbCdEfGhIjKlMnOpQrStUv et 0197123412';
    const cleaned = scrubString(text);
    expect(cleaned).not.toContain('97123412');
    expect(cleaned).not.toContain('awa@example.com');
    expect(cleaned).not.toContain('AbCdEfGhIjKlMnOpQrStUv');
    expect(cleaned).toContain('+229 •• •• •• 12');
    expect(cleaned).toContain('/i/[token]');
  });

  it('ne touche pas un texte sans donnée personnelle', () => {
    expect(scrubString('Timeout lors de la lecture de la table events')).toBe(
      'Timeout lors de la lecture de la table events',
    );
  });
});

describe('scrubEvent', () => {
  const event = {
    user: { id: 'u1', email: 'a@b.co', ip_address: '1.2.3.4' },
    server_name: 'host',
    transaction: '/i/AbCdEfGhIjKlMnOpQrStUv',
    message: 'Erreur pour +22997123412',
    request: {
      url: 'https://x.test/i/AbCdEfGhIjKlMnOpQrStUv?utm=1',
      cookies: { a: 'b' },
      headers: { cookie: 'a=b', authorization: 'Bearer z' },
      query_string: 'x=1',
      data: { phone: '+22997123412' },
    },
    extra: { full_name: 'Awa Dossou', phone_e164: '+22997123412', eventId: 'evt_1', name: 'Awa' },
    tags: { route: '/i/[token]' },
    contexts: { runtime: { name: 'node' } },
    breadcrumbs: [
      {
        message: 'GET /i/AbCdEfGhIjKlMnOpQrStUv',
        data: { url: 'https://x.test/i/AbCdEfGhIjKlMnOpQrStUv?z=1', guest: { id: 1 } },
      },
    ],
  };

  it('supprime utilisateur, cookies, en-têtes, corps et requête', () => {
    const cleaned = scrubEvent(event) as typeof event & { user?: unknown };
    expect(cleaned.user).toBeUndefined();
    expect(cleaned.request.url).toBe('https://x.test/i/[token]');
    expect(cleaned.request).not.toHaveProperty('cookies');
    expect(cleaned.request).not.toHaveProperty('headers');
    expect(cleaned.request).not.toHaveProperty('data');
    expect(cleaned.request).not.toHaveProperty('query_string');
    expect(cleaned.transaction).toBe('/i/[token]');
    expect(cleaned.message).toBe('Erreur pour +229 •• •• •• 12');
  });

  it('filtre les clés sensibles et garde les identifiants techniques', () => {
    const cleaned = scrubEvent(event);
    expect(cleaned.extra.full_name).toBe('[Filtered]');
    expect(cleaned.extra.phone_e164).toBe('[Filtered]');
    expect(cleaned.extra.name).toBe('[Filtered]');
    expect(cleaned.extra.eventId).toBe('evt_1');
    expect(cleaned.contexts.runtime.name).toBe('node');
    expect(cleaned.breadcrumbs[0]?.message).toBe('GET /i/[token]');
    expect(cleaned.breadcrumbs[0]?.data.url).toBe('https://x.test/i/[token]');
    expect(cleaned.breadcrumbs[0]?.data.guest).toBe('[Filtered]');
  });

  it('ne laisse aucun fragment de donnée personnelle dans la sortie sérialisée', () => {
    const dump = JSON.stringify(scrubEvent(event));
    for (const forbidden of [
      '97123412',
      'Awa Dossou',
      'AbCdEfGhIjKlMnOpQrStUv',
      'a@b.co',
      '1.2.3.4',
    ]) {
      expect(dump).not.toContain(forbidden);
    }
  });

  it('ne modifie pas l’objet d’origine', () => {
    const copy = structuredClone(event);
    scrubEvent(event);
    expect(event).toEqual(copy);
  });

  it('gère les structures cycliques profondes sans planter', () => {
    let deep: Record<string, unknown> = { leaf: 'x' };
    for (let i = 0; i < 30; i += 1) deep = { next: deep };
    expect(() => scrubEvent({ extra: deep })).not.toThrow();
  });
});

describe('scrubBreadcrumb', () => {
  it('nettoie message et données', () => {
    const cleaned = scrubBreadcrumb({
      message: 'fetch /i/AbCdEfGhIjKlMnOpQrStUv',
      data: { url: '/i/AbCdEfGhIjKlMnOpQrStUv?a=1', phone: '+22997123412' },
    });
    expect(cleaned.message).toBe('fetch /i/[token]');
    expect(cleaned.data.url).toBe('/i/[token]');
    expect(cleaned.data.phone).toBe('[Filtered]');
  });
});
