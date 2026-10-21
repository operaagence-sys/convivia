-- Tranche 1 — socle (5/5) : tarifs Meta, taux de change, modèles WhatsApp.
-- Sources : docs/07-schema-backend.md § 9.1, § 9.2, § 9.3, § 13 ;
-- docs/06-trd.md § 2.1, § 2.5, § 13.4.
--
-- Pas de tables admin en tranche 1 (décision C6) : `created_by` nullable et
-- sans clé étrangère ; aucune politique FIN / SA (lecture) ni SA (écriture
-- journalisée) : elles viendront par une nouvelle migration (tranche 8 / 15).
-- En attendant, seul le serveur lit ces tables.

-- ---------------------------------------------------------------------------
-- 1. whatsapp_rates (07 § 9.1) — tarifs Meta en micro-dollars
-- ---------------------------------------------------------------------------
create table public.whatsapp_rates (
  id uuid primary key default gen_random_uuid(),
  category public.wa_category not null,
  pricing_zone text not null,
  price_usd_micros bigint not null,
  valid_from timestamptz not null,
  created_by uuid,
  created_at timestamptz not null default now(),
  constraint whatsapp_rates_pricing_zone_format check (pricing_zone ~ '^[a-z][a-z_]*$'),
  constraint whatsapp_rates_price_non_negative check (price_usd_micros >= 0),
  constraint whatsapp_rates_one_price_per_version unique (category, pricing_zone, valid_from)
);

comment on table public.whatsapp_rates is
  'Tarifs Meta par catégorie et zone, en micro-dollars (1 $ = 1 000 000). Nouvelle ligne à chaque changement de grille (docs/07 § 9.1, docs/06 § 2.1).';
comment on column public.whatsapp_rates.created_by is
  'Admin auteur ; nullable et sans clé étrangère tant que admin_users n''existe pas (décision C6).';

alter table public.whatsapp_rates enable row level security;

revoke all on table public.whatsapp_rates from anon, authenticated, service_role;
grant select on table public.whatsapp_rates to service_role;

-- Grille Meta « Rest of Africa » au 1er octobre 2026 (TRD § 2.1) :
-- marketing 0,0225 $ ; utilitaire, authentification, service 0,0040 $
-- (service : au-delà de 1 000 gratuits par mois et par numéro).
insert into public.whatsapp_rates (category, pricing_zone, price_usd_micros, valid_from) values
  ('marketing', 'rest_of_africa', 22500, '2026-10-01 00:00:00+00'),
  ('utility', 'rest_of_africa', 4000, '2026-10-01 00:00:00+00'),
  ('authentication', 'rest_of_africa', 4000, '2026-10-01 00:00:00+00'),
  ('service', 'rest_of_africa', 4000, '2026-10-01 00:00:00+00');

-- ---------------------------------------------------------------------------
-- 2. fx_rates (07 § 9.2) — taux de change mensuel
-- ---------------------------------------------------------------------------
create table public.fx_rates (
  month date primary key,
  usd_xof integer not null,
  created_by uuid,
  created_at timestamptz not null default now(),
  constraint fx_rates_month_first_day check (extract(day from month) = 1),
  constraint fx_rates_usd_xof_positive check (usd_xof > 0)
);

comment on table public.fx_rates is
  'Taux de change mémorisé par mois (1er du mois) : FCFA pour 1 $ (docs/07 § 9.2, docs/06 § 13.4).';
comment on column public.fx_rates.created_by is
  'Admin auteur ; nullable et sans clé étrangère tant que admin_users n''existe pas (décision C6).';

alter table public.fx_rates enable row level security;

revoke all on table public.fx_rates from anon, authenticated, service_role;
grant select on table public.fx_rates to service_role;

-- 600 FCFA pour 1 $ à partir d'octobre 2026 (hypothèse prudente, TRD § 2.1).
insert into public.fx_rates (month, usd_xof) values
  ('2026-10-01', 600);

-- ---------------------------------------------------------------------------
-- 3. whatsapp_templates (07 § 9.3) — vide en tranche 1 (modèles : tranche 11)
-- ---------------------------------------------------------------------------
create table public.whatsapp_templates (
  name text primary key,
  category public.wa_category not null,
  meta_status text not null,
  quality text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint whatsapp_templates_name_format check (name ~ '^[a-z][a-z0-9_]*$' and char_length(name) <= 512),
  constraint whatsapp_templates_meta_status_check check (meta_status in ('approved', 'paused', 'rejected'))
);

comment on table public.whatsapp_templates is
  'État des modèles de messages chez Meta, mis à jour par webhook (serveur seulement). Lecture SA ajoutée avec les tables admin (docs/07 § 9.3, décision C6).';

create trigger whatsapp_templates_set_updated_at
  before update on public.whatsapp_templates
  for each row execute function private.set_updated_at();

alter table public.whatsapp_templates enable row level security;

revoke all on table public.whatsapp_templates from anon, authenticated, service_role;
grant select, insert, update on table public.whatsapp_templates to service_role;
