-- Tranche 1 — socle : le visiteur (anon) ne lit QUE les pays actifs et les
-- paliers de prix actifs ; rien d'autre, aucune écriture (décision C4 ;
-- docs/07 § 1.1, § 3.1, § 8.1, § 17).
begin;
create extension if not exists pgtap with schema extensions;

select plan(16);

-- Données de test (fictives) : un pays et un palier INACTIFS, et une ligne
-- dans chaque table serveur, pour que « aucune ligne » ait un sens.
insert into public.countries (code, name, timezone, dial_code, is_active)
  values ('ZZ', 'Pays fictif', 'Africa/Abidjan', '+999', false);
insert into public.pricing_tiers (seats, unit_price, is_active)
  values (50, 300, false);
insert into public.audit_log (actor_kind, action) values ('system', 'test.seeded');
insert into public.analytics_events (name) values ('event.created');
insert into public.whatsapp_templates (name, category, meta_status)
  values ('test_template_v1', 'utility', 'approved');

-- Privilèges d'anon sur TOUT le schéma public (présent et futur) --------- (2)
select is(
  array(
    select format('%s:%s', c.relname, p.priv)
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    cross join unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) as p(priv)
    where n.nspname = 'public'
      and c.relkind in ('r', 'p', 'v', 'm', 'f')
      and case
            when p.priv in ('SELECT', 'INSERT', 'UPDATE', 'REFERENCES')
              then has_any_column_privilege('anon', c.oid, p.priv)
            else has_table_privilege('anon', c.oid, p.priv)
          end
    order by 1
  ),
  array['countries:SELECT', 'pricing_tiers:SELECT'],
  'anon : seul privilège = SELECT sur countries et pricing_tiers'
);
select is(
  (
    select count(*)
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'S'
      and (has_sequence_privilege('anon', c.oid, 'USAGE')
           or has_sequence_privilege('anon', c.oid, 'SELECT')
           or has_sequence_privilege('anon', c.oid, 'UPDATE'))
  ),
  0::bigint,
  'anon : aucun droit sur les séquences du schéma public'
);

-- En tant qu'anon --------------------------------------------------------------
set local role anon;
set local "request.jwt.claims" to '{"role":"anon"}';

-- Lecture : pays actifs et paliers actifs seulement ---------------------- (2)
select results_eq(
  'select code::text from public.countries order by code',
  $$values ('BJ'), ('CI'), ('SN'), ('TG')$$,
  'anon lit les 4 pays actifs, pas le pays inactif'
);
select results_eq(
  'select seats, unit_price, total_price from public.pricing_tiers order by seats',
  $$values (50, 200, 10000), (100, 190, 19000), (200, 175, 35000),
           (300, 165, 49500), (500, 155, 77500), (1000, 150, 150000)$$,
  'anon lit les 6 paliers actifs, pas le palier inactif'
);

-- Aucune ligne des autres tables (permission refusée) -------------------- (6)
select throws_ok('select * from public.platform_settings', '42501', null,
  'anon ne lit pas platform_settings');
select throws_ok('select * from public.audit_log', '42501', null,
  'anon ne lit pas audit_log');
select throws_ok('select * from public.analytics_events', '42501', null,
  'anon ne lit pas analytics_events');
select throws_ok('select * from public.whatsapp_rates', '42501', null,
  'anon ne lit pas whatsapp_rates');
select throws_ok('select * from public.fx_rates', '42501', null,
  'anon ne lit pas fx_rates');
select throws_ok('select * from public.whatsapp_templates', '42501', null,
  'anon ne lit pas whatsapp_templates');

-- Aucune écriture ---------------------------------------------------------- (6)
select throws_ok(
  $$insert into public.countries (code, name, timezone, dial_code, is_active)
    values ('ZY', 'Faux pays', 'Africa/Abidjan', '+998', true)$$,
  '42501', null, 'anon n''insère pas de pays');
select throws_ok(
  'update public.countries set is_active = false',
  '42501', null, 'anon ne désactive pas un pays');
select throws_ok(
  $$insert into public.pricing_tiers (seats, unit_price, is_active) values (100, 150, false)$$,
  '42501', null, 'anon n''insère pas de palier');
select throws_ok(
  'delete from public.pricing_tiers',
  '42501', null, 'anon ne supprime pas de palier');
select throws_ok(
  $$insert into public.analytics_events (name) values ('organizer.signed_up')$$,
  '42501', null, 'anon n''écrit pas dans analytics_events');
select throws_ok(
  $$insert into public.audit_log (actor_kind, action) values ('system', 'test.forged')$$,
  '42501', null, 'anon n''écrit pas dans audit_log');

reset role;

select * from finish();
rollback;
