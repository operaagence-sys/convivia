-- Tranche 1 — socle : un utilisateur connecté (organisateur, ou admin même
-- en aal2 tant que les droits admin n'existent pas, décision C6) lit les pays
-- et paliers actifs, et n'écrit RIEN sur les tables du socle (docs/07 § 13,
-- § 17).
begin;
create extension if not exists pgtap with schema extensions;

select plan(34);

insert into public.countries (code, name, timezone, dial_code, is_active)
  values ('ZZ', 'Pays fictif', 'Africa/Abidjan', '+999', false);
insert into public.pricing_tiers (seats, unit_price, is_active)
  values (50, 300, false);

-- Privilèges d'authenticated sur les 8 tables du socle -------------------- (2)
select is(
  array(
    select format('%s:%s', c.relname, p.priv)
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    cross join unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) as p(priv)
    where n.nspname = 'public'
      and c.relname in ('countries', 'platform_settings', 'audit_log', 'analytics_events',
                        'pricing_tiers', 'whatsapp_rates', 'fx_rates', 'whatsapp_templates')
      and case
            when p.priv in ('SELECT', 'INSERT', 'UPDATE', 'REFERENCES')
              then has_any_column_privilege('authenticated', c.oid, p.priv)
            else has_table_privilege('authenticated', c.oid, p.priv)
          end
    order by 1
  ),
  array['countries:SELECT', 'pricing_tiers:SELECT'],
  'authenticated : seul privilège = SELECT sur countries et pricing_tiers'
);
select is(
  (
    select count(*)
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'S'
      and (has_sequence_privilege('authenticated', c.oid, 'USAGE')
           or has_sequence_privilege('authenticated', c.oid, 'SELECT')
           or has_sequence_privilege('authenticated', c.oid, 'UPDATE'))
  ),
  0::bigint,
  'authenticated : aucun droit sur les séquences du schéma public'
);

-- En tant qu'utilisateur connecté, second facteur validé -----------------------
set local role authenticated;
set local "request.jwt.claims" to
  '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}';

-- Lecture ------------------------------------------------------------------ (8)
select results_eq(
  'select code::text from public.countries order by code',
  $$values ('BJ'), ('CI'), ('SN'), ('TG')$$,
  'authenticated lit les 4 pays actifs, pas le pays inactif'
);
select results_eq(
  'select seats, unit_price from public.pricing_tiers order by seats',
  $$values (50, 200), (100, 190), (200, 175), (300, 165), (500, 155), (1000, 150)$$,
  'authenticated lit les 6 paliers actifs, pas le palier inactif'
);
select throws_ok('select * from public.platform_settings', '42501', null,
  'authenticated ne lit pas platform_settings');
select throws_ok('select * from public.audit_log', '42501', null,
  'authenticated (même aal2) ne lit pas audit_log');
select throws_ok('select * from public.analytics_events', '42501', null,
  'authenticated ne lit pas analytics_events');
select throws_ok('select * from public.whatsapp_rates', '42501', null,
  'authenticated ne lit pas whatsapp_rates');
select throws_ok('select * from public.fx_rates', '42501', null,
  'authenticated ne lit pas fx_rates');
select throws_ok('select * from public.whatsapp_templates', '42501', null,
  'authenticated ne lit pas whatsapp_templates');

-- INSERT refusé ------------------------------------------------------------ (8)
select throws_ok(
  $$insert into public.countries (code, name, timezone, dial_code, is_active)
    values ('ZY', 'Faux pays', 'Africa/Abidjan', '+998', true)$$,
  '42501', null, 'authenticated : INSERT countries refusé');
select throws_ok(
  $$insert into public.platform_settings (key, value) values ('test.key', '1')$$,
  '42501', null, 'authenticated : INSERT platform_settings refusé');
select throws_ok(
  $$insert into public.audit_log (actor_kind, action) values ('system', 'test.forged')$$,
  '42501', null, 'authenticated : INSERT audit_log refusé');
select throws_ok(
  $$insert into public.analytics_events (name) values ('event.created')$$,
  '42501', null, 'authenticated : INSERT analytics_events refusé');
select throws_ok(
  $$insert into public.pricing_tiers (seats, unit_price, is_active) values (100, 150, false)$$,
  '42501', null, 'authenticated : INSERT pricing_tiers refusé');
select throws_ok(
  $$insert into public.whatsapp_rates (category, pricing_zone, price_usd_micros, valid_from)
    values ('marketing', 'rest_of_africa', 1, now())$$,
  '42501', null, 'authenticated : INSERT whatsapp_rates refusé');
select throws_ok(
  $$insert into public.fx_rates (month, usd_xof) values ('2030-01-01', 1)$$,
  '42501', null, 'authenticated : INSERT fx_rates refusé');
select throws_ok(
  $$insert into public.whatsapp_templates (name, category, meta_status)
    values ('test_v1', 'utility', 'approved')$$,
  '42501', null, 'authenticated : INSERT whatsapp_templates refusé');

-- UPDATE refusé ------------------------------------------------------------ (8)
select throws_ok('update public.countries set is_active = true',
  '42501', null, 'authenticated : UPDATE countries refusé');
select throws_ok('update public.platform_settings set value = value',
  '42501', null, 'authenticated : UPDATE platform_settings refusé');
select throws_ok('update public.audit_log set action = action',
  '42501', null, 'authenticated : UPDATE audit_log refusé');
select throws_ok('update public.analytics_events set name = name',
  '42501', null, 'authenticated : UPDATE analytics_events refusé');
select throws_ok('update public.pricing_tiers set is_active = is_active',
  '42501', null, 'authenticated : UPDATE pricing_tiers refusé');
select throws_ok('update public.whatsapp_rates set price_usd_micros = price_usd_micros',
  '42501', null, 'authenticated : UPDATE whatsapp_rates refusé');
select throws_ok('update public.fx_rates set usd_xof = usd_xof',
  '42501', null, 'authenticated : UPDATE fx_rates refusé');
select throws_ok('update public.whatsapp_templates set quality = quality',
  '42501', null, 'authenticated : UPDATE whatsapp_templates refusé');

-- DELETE refusé ------------------------------------------------------------ (8)
select throws_ok('delete from public.countries',
  '42501', null, 'authenticated : DELETE countries refusé');
select throws_ok('delete from public.platform_settings',
  '42501', null, 'authenticated : DELETE platform_settings refusé');
select throws_ok('delete from public.audit_log',
  '42501', null, 'authenticated : DELETE audit_log refusé');
select throws_ok('delete from public.analytics_events',
  '42501', null, 'authenticated : DELETE analytics_events refusé');
select throws_ok('delete from public.pricing_tiers',
  '42501', null, 'authenticated : DELETE pricing_tiers refusé');
select throws_ok('delete from public.whatsapp_rates',
  '42501', null, 'authenticated : DELETE whatsapp_rates refusé');
select throws_ok('delete from public.fx_rates',
  '42501', null, 'authenticated : DELETE fx_rates refusé');
select throws_ok('delete from public.whatsapp_templates',
  '42501', null, 'authenticated : DELETE whatsapp_templates refusé');

reset role;

select * from finish();
rollback;
