-- Tranche 1 — socle (4/5) : grille de prix.
-- Sources : docs/07-schema-backend.md § 8.1, § 13 ; docs/01-prd.md § 7.1
-- (grille qui fait foi : 200, 190, 175, 165, 155, 150 FCFA ; PAS celle de la
-- synthèse 00).
--
-- Pas de tables admin en tranche 1 (décision C6) :
-- - `created_by` est nullable et sans clé étrangère vers admin_users ;
-- - aucune politique super-admin (INSERT, UPDATE de is_active, journalisés) :
--   elle viendra par une nouvelle migration (tranche 8) ;
-- - la lecture par les rôles admin (MKT, FIN, SUP selon 07 § 13) reste à
--   trancher (question C5, tranche 8).
--
-- Changer la grille = désactiver une ligne et en créer une nouvelle : les
-- paiements passés gardent leur palier. Un déclencheur refuse donc toute
-- modification autre que `is_active`, ainsi que DELETE et TRUNCATE.
--
-- Le SELECT d'anon (paliers actifs publics, 07 § 8.1) provient des privilèges
-- par défaut du schéma public (le hook rls-check refuse « grant … to anon ») ;
-- vérifié par le test pgTAP 01_anon_access.

create table public.pricing_tiers (
  id uuid primary key default gen_random_uuid(),
  seats integer not null,
  unit_price integer not null,
  total_price integer generated always as (seats * unit_price) stored,
  is_active boolean not null default false,
  valid_from timestamptz not null default now(),
  created_by uuid,
  created_at timestamptz not null default now(),
  -- Paliers du PRD § 7.1 ; au-delà de 1 000 invités : devis (quote_requests).
  constraint pricing_tiers_seats_check check (seats in (50, 100, 200, 300, 500, 1000)),
  -- Montants en FCFA entiers ; plancher 150 FCFA par invité (PRD § 7.1).
  constraint pricing_tiers_unit_price_min check (unit_price >= 150)
);

-- Un seul palier actif par nombre de places.
create unique index pricing_tiers_one_active_per_seats
  on public.pricing_tiers (seats)
  where is_active;

comment on table public.pricing_tiers is
  'Grille de prix par palier (FCFA). Lecture des paliers actifs : anon, authenticated. Lignes immuables sauf is_active ; suppression interdite (docs/07 § 8.1).';
comment on column public.pricing_tiers.total_price is 'Colonne générée : seats × unit_price (FCFA).';
comment on column public.pricing_tiers.created_by is
  'Admin auteur du palier ; nullable et sans clé étrangère tant que admin_users n''existe pas (décision C6).';

create or replace function private.pricing_tiers_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
     and (to_jsonb(new) - 'is_active' - 'total_price') = (to_jsonb(old) - 'is_active' - 'total_price') then
    return new;
  end if;
  raise exception '% on public.pricing_tiers is not allowed (only is_active may change)', tg_op
    using errcode = 'P0001';
end;
$$;

comment on function private.pricing_tiers_guard() is
  'Déclencheur : seule la colonne is_active d''un palier est modifiable ; DELETE refusé (docs/07 § 8.1).';

revoke all on function private.pricing_tiers_guard() from public, anon, authenticated;

create trigger pricing_tiers_guard_update_delete
  before update or delete on public.pricing_tiers
  for each row execute function private.pricing_tiers_guard();

create trigger pricing_tiers_reject_truncate
  before truncate on public.pricing_tiers
  for each statement execute function private.reject_modification();

alter table public.pricing_tiers enable row level security;

revoke all on table public.pricing_tiers from authenticated, service_role;
revoke insert, update, delete, truncate, references, trigger, maintain
  on table public.pricing_tiers from anon;
grant select on table public.pricing_tiers to authenticated, service_role;

create policy pricing_tiers_select_active_anon
  on public.pricing_tiers
  for select
  to anon
  using (is_active);

create policy pricing_tiers_select_active_authenticated
  on public.pricing_tiers
  for select
  to authenticated
  using (is_active);

comment on policy pricing_tiers_select_active_anon on public.pricing_tiers is
  'Visiteur : paliers actifs seulement (vitrine, docs/07 § 8.1).';
comment on policy pricing_tiers_select_active_authenticated on public.pricing_tiers is
  'Organisateur connecté : paliers actifs seulement (écran forfait, docs/07 § 8.1).';

-- Grille officielle du MVP (PRD § 7.1).
insert into public.pricing_tiers (seats, unit_price, is_active) values
  (50, 200, true),
  (100, 190, true),
  (200, 175, true),
  (300, 165, true),
  (500, 155, true),
  (1000, 150, true);
