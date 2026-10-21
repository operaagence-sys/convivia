-- Tranche 1 — socle : grille de prix (docs/01-prd.md § 7.1 ;
-- docs/07-schema-backend.md § 8.1).
begin;
create extension if not exists pgtap with schema extensions;

select plan(16);

-- Grille officielle du MVP, et rien d'autre ------------------------------- (3)
select results_eq(
  'select seats, unit_price, total_price, is_active from public.pricing_tiers order by seats',
  $$values (50, 200, 10000, true), (100, 190, 19000, true), (200, 175, 35000, true),
           (300, 165, 49500, true), (500, 155, 77500, true), (1000, 150, 150000, true)$$,
  'grille du PRD § 7.1 : 6 paliers actifs, totaux exacts en FCFA'
);
select is(
  (
    select a.attgenerated::text
    from pg_catalog.pg_attribute a
    where a.attrelid = 'public.pricing_tiers'::regclass and a.attname = 'total_price'
  ),
  's',
  'total_price est une colonne générée (stockée)'
);
select col_not_null('public', 'pricing_tiers', 'total_price',
  'total_price est obligatoire (NOT NULL, migration 20261021140700)');

-- Contraintes ------------------------------------------------------------- (5)
select throws_ok(
  $$insert into public.pricing_tiers (seats, unit_price, is_active) values (50, 149, false)$$,
  '23514', null, 'prix unitaire < 150 FCFA refusé');
select lives_ok(
  $$insert into public.pricing_tiers (seats, unit_price, is_active) values (50, 150, false)$$,
  'prix unitaire = 150 FCFA accepté (palier inactif)');
select throws_ok(
  $$insert into public.pricing_tiers (seats, unit_price, total_price, is_active) values (50, 200, 1, false)$$,
  '428C9', null, 'total_price ne peut pas être saisi');
select throws_ok(
  $$insert into public.pricing_tiers (seats, unit_price, is_active) values (100, 180, true)$$,
  '23505', null, 'un seul palier actif par nombre de places');
select throws_ok(
  $$insert into public.pricing_tiers (seats, unit_price, is_active) values (75, 200, false)$$,
  '23514', null, 'palier hors grille (75 places) refusé');

-- Lignes immuables sauf is_active ---------------------------------------- (2)
select throws_ok(
  $$update public.pricing_tiers set unit_price = 160 where seats = 1000 and is_active$$,
  'P0001', null, 'modifier le prix d''un palier existant est refusé');
select throws_ok(
  $$update public.pricing_tiers set seats = 300 where seats = 1000 and is_active$$,
  'P0001', null, 'modifier le nombre de places d''un palier existant est refusé');

-- Changer la grille = désactiver puis activer une autre ligne ------------- (3)
select lives_ok(
  $$update public.pricing_tiers set is_active = false where seats = 50 and unit_price = 200$$,
  'désactiver un palier est accepté');
select lives_ok(
  $$update public.pricing_tiers set is_active = true where seats = 50 and unit_price = 150$$,
  'activer le nouveau palier est accepté');
select results_eq(
  'select unit_price, total_price from public.pricing_tiers where seats = 50 and is_active',
  $$values (150, 7500)$$,
  'le palier 50 actif est le nouveau, total recalculé');

-- Suppression interdite --------------------------------------------------- (2)
select throws_ok(
  'delete from public.pricing_tiers where seats = 50 and unit_price = 200',
  'P0001', null, 'DELETE d''un palier refusé');
select throws_ok(
  'truncate public.pricing_tiers',
  'P0001', null, 'TRUNCATE de la grille refusé');

-- Le serveur lit seulement ------------------------------------------------ (1)
set local role service_role;
select throws_ok(
  $$insert into public.pricing_tiers (seats, unit_price, is_active) values (100, 150, false)$$,
  '42501', null, 'service_role : INSERT pricing_tiers refusé (écriture réservée au super-admin)');
reset role;

select * from finish();
rollback;
