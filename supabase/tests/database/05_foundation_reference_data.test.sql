-- Tranche 1 — socle : données initiales et contraintes des tables de
-- référence (docs/07 § 3.1, § 3.2, § 9.1 à § 9.3 ; docs/06 § 2.1, § 2.8).
begin;
create extension if not exists pgtap with schema extensions;

select plan(16);

-- Données initiales ------------------------------------------------------- (5)
select results_eq(
  'select code::text, name, timezone, dial_code, is_active from public.countries order by code',
  $$values ('BJ', 'Bénin', 'Africa/Porto-Novo', '+229', true),
           ('CI', 'Côte d''Ivoire', 'Africa/Abidjan', '+225', true),
           ('SN', 'Sénégal', 'Africa/Dakar', '+221', true),
           ('TG', 'Togo', 'Africa/Lome', '+228', true)$$,
  'pays : BJ, CI, TG, SN actifs avec fuseau et indicatif'
);
select results_eq(
  'select key, value from public.platform_settings order by key',
  $$values ('whatsapp.recipient_limit_24h', '250'::jsonb)$$,
  'réglages : seulement la limite Meta de 250 destinataires / 24 h'
);
select results_eq(
  $$select category::text, pricing_zone, price_usd_micros, valid_from = '2026-10-01 00:00:00+00'::timestamptz
    from public.whatsapp_rates order by 1$$,
  $$values ('authentication', 'rest_of_africa', 4000::bigint, true),
           ('marketing', 'rest_of_africa', 22500::bigint, true),
           ('service', 'rest_of_africa', 4000::bigint, true),
           ('utility', 'rest_of_africa', 4000::bigint, true)$$,
  'tarifs Meta Rest of Africa au 1er octobre 2026 (micro-dollars)'
);
select results_eq(
  'select month, usd_xof from public.fx_rates order by month',
  $$values ('2026-10-01'::date, 600)$$,
  'taux de change : 600 FCFA pour 1 $ à partir d''octobre 2026'
);
select is_empty(
  'select * from public.whatsapp_templates',
  'whatsapp_templates vide en tranche 1'
);

-- Contraintes ------------------------------------------------------------- (9)
select throws_ok(
  $$insert into public.countries (code, name, timezone, dial_code) values ('zz', 'X', 'Africa/Abidjan', '+999')$$,
  '23514', null, 'pays : code en minuscules refusé');
select throws_ok(
  $$insert into public.countries (code, name, timezone, dial_code) values ('ZZ', 'X', 'Africa/Abidjan', '229')$$,
  '23514', null, 'pays : indicatif sans + refusé');
select throws_ok(
  $$insert into public.platform_settings (key, value) values ('Bad Key', '1')$$,
  '23514', null, 'réglages : clé mal formée refusée');
select throws_ok(
  $$insert into public.whatsapp_rates (category, pricing_zone, price_usd_micros, valid_from)
    values ('marketing', 'rest_of_africa', -1, '2027-01-01 00:00:00+00')$$,
  '23514', null, 'tarif Meta négatif refusé');
select throws_ok(
  $$insert into public.whatsapp_rates (category, pricing_zone, price_usd_micros, valid_from)
    values ('marketing', 'Rest of Africa', 1, '2027-01-01 00:00:00+00')$$,
  '23514', null, 'zone tarifaire mal formée refusée');
select throws_ok(
  $$insert into public.fx_rates (month, usd_xof) values ('2026-11-15', 600)$$,
  '23514', null, 'taux de change : mois autre que le 1er refusé');
select throws_ok(
  $$insert into public.fx_rates (month, usd_xof) values ('2026-11-01', 0)$$,
  '23514', null, 'taux de change nul refusé');
select throws_ok(
  $$insert into public.whatsapp_templates (name, category, meta_status) values ('Invitation V1', 'marketing', 'approved')$$,
  '23514', null, 'modèle WhatsApp : nom mal formé refusé');
select throws_ok(
  $$insert into public.whatsapp_templates (name, category, meta_status) values ('invitation_v1', 'marketing', 'unknown')$$,
  '23514', null, 'modèle WhatsApp : statut Meta hors liste refusé');

-- updated_at maintenu par déclencheur ------------------------------------ (2)
update public.countries set name = name where code = 'BJ';
select is(
  (select updated_at from public.countries where code = 'BJ'),
  now(),
  'countries.updated_at mis à jour à la modification'
);
update public.platform_settings set value = '250'::jsonb where key = 'whatsapp.recipient_limit_24h';
select is(
  (select updated_at from public.platform_settings where key = 'whatsapp.recipient_limit_24h'),
  now(),
  'platform_settings.updated_at mis à jour à la modification'
);

select * from finish();
rollback;
