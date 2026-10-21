-- Tranche 1 — socle (2/5) : pays couverts et réglages plateforme.
-- Sources : docs/07-schema-backend.md § 3.1, § 3.2, § 13 ; docs/01-prd.md § 2 ;
-- docs/06-trd.md § 1.3, § 2.8.
--
-- Droits (pas de tables admin en tranche 1, décision C6) : aucune politique
-- super-admin ici. Les droits SA (écriture des pays, lecture / écriture des
-- réglages, journalisées) viendront par une nouvelle migration avec les tables
-- admin (tranche 2 / 8). `platform_settings.updated_by` reste donc nullable et
-- sans clé étrangère vers admin_users.
--
-- Privilèges : on retire tout aux rôles de l'API puis on accorde le strict
-- nécessaire, pour ne pas dépendre des privilèges par défaut du projet.
-- Exception : le SELECT d'anon sur `countries` n'est pas retiré (pays actifs
-- publics, 07 § 3.1) ; il provient des privilèges par défaut du schéma public,
-- le hook rls-check refusant tout « grant … to anon » écrit dans une migration.
-- Le test pgTAP 01_anon_access le vérifie.

-- ---------------------------------------------------------------------------
-- 1. countries
-- ---------------------------------------------------------------------------
create table public.countries (
  code char(2) primary key,
  name text not null,
  timezone text not null,
  dial_code text not null,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint countries_code_format check (code ~ '^[A-Z]{2}$'),
  constraint countries_name_not_blank check (btrim(name) <> ''),
  constraint countries_timezone_format check (timezone ~ '^[A-Za-z]+/[A-Za-z_-]+$'),
  constraint countries_dial_code_format check (dial_code ~ '^\+[1-9][0-9]{0,2}$')
);

comment on table public.countries is
  'Pays couverts (FedaPay). is_active = ouvert à l''inscription. Lecture des pays actifs : anon, authenticated (docs/07 § 3.1).';
comment on column public.countries.timezone is 'Fuseau IANA de l''événement par défaut (docs/06 § 1.3).';
comment on column public.countries.dial_code is 'Indicatif international, ex. +229.';

create trigger countries_set_updated_at
  before update on public.countries
  for each row execute function private.set_updated_at();

alter table public.countries enable row level security;

revoke all on table public.countries from authenticated, service_role;
revoke insert, update, delete, truncate, references, trigger, maintain
  on table public.countries from anon;
grant select on table public.countries to authenticated, service_role;

create policy countries_select_active_anon
  on public.countries
  for select
  to anon
  using (is_active);

create policy countries_select_active_authenticated
  on public.countries
  for select
  to authenticated
  using (is_active);

comment on policy countries_select_active_anon on public.countries is
  'Visiteur : pays actifs seulement (formulaires publics, docs/07 § 3.1).';
comment on policy countries_select_active_authenticated on public.countries is
  'Organisateur / admin connecté : pays actifs seulement (docs/07 § 3.1).';

insert into public.countries (code, name, timezone, dial_code, is_active) values
  ('BJ', 'Bénin', 'Africa/Porto-Novo', '+229', true),
  ('CI', 'Côte d''Ivoire', 'Africa/Abidjan', '+225', true),
  ('TG', 'Togo', 'Africa/Lome', '+228', true),
  ('SN', 'Sénégal', 'Africa/Dakar', '+221', true);

-- ---------------------------------------------------------------------------
-- 2. platform_settings
-- ---------------------------------------------------------------------------
create table public.platform_settings (
  key text primary key,
  value jsonb not null,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_settings_key_format check (key ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$')
);

comment on table public.platform_settings is
  'Réglages plateforme clé / valeur (limite d''envoi Meta…). Serveur seulement en tranche 1 ; droits SA ajoutés avec les tables admin (docs/07 § 3.2, décision C6).';
comment on column public.platform_settings.updated_by is
  'Auteur de la dernière modification (admin) ; nullable et sans clé étrangère tant que admin_users n''existe pas (décision C6).';

create trigger platform_settings_set_updated_at
  before update on public.platform_settings
  for each row execute function private.set_updated_at();

alter table public.platform_settings enable row level security;

-- Aucune politique : refus par défaut pour anon et authenticated.
revoke all on table public.platform_settings from anon, authenticated, service_role;
grant select, insert, update on table public.platform_settings to service_role;

-- Limite Meta d'un nouveau portefeuille : 250 destinataires différents par
-- 24 h glissantes (docs/06 § 2.8). Mise à jour par le serveur ensuite.
insert into public.platform_settings (key, value) values
  ('whatsapp.recipient_limit_24h', '250'::jsonb);
