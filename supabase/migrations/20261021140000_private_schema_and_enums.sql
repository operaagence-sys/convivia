-- Tranche 1 — socle (1/5) : schéma `private`, fonctions de déclencheur
-- communes et les 22 types énumérés.
-- Sources : docs/07-schema-backend.md § 1.2, § 1.3, § 1.4, § 1.5.

-- ---------------------------------------------------------------------------
-- 1. Schéma `private`
-- ---------------------------------------------------------------------------
-- Non exposé par PostgREST (seuls `public` et `graphql_public` le sont,
-- supabase/config.toml [api].schemas). Aucun droit pour anon ni
-- authenticated : un client ne peut ni lister ni appeler ce qui s'y trouve.
-- Les fonctions d'aide de 07 § 1.3 (is_event_owner, is_active_owner,
-- has_admin_role, has_any_admin_role, has_permission, is_over_cap) y seront
-- créées avec les tables dont elles dépendent (tranches 2, 3, 4 et 8), avec
-- leurs propres GRANT au strict nécessaire.
create schema if not exists private;

revoke all on schema private from public;
revoke all on schema private from anon, authenticated;

comment on schema private is
  'Fonctions internes (aide RLS, déclencheurs). Non exposé par l''API ; aucun droit pour anon / authenticated (docs/07 § 1.3).';

-- ---------------------------------------------------------------------------
-- 2. Fonctions de déclencheur communes
-- ---------------------------------------------------------------------------
-- SECURITY INVOKER (pas besoin de droits élevés), search_path vide : tous les
-- noms sont résolus dans pg_catalog, aucune substitution possible.

-- Maintient `updated_at` sur les lignes modifiables (07 § 1.5).
create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

comment on function private.set_updated_at() is
  'Déclencheur BEFORE UPDATE : met updated_at à now() (docs/07 § 1.5).';

-- Refuse l'opération en cours : tables en ajout seul (audit_log…) et
-- suppressions interdites (pricing_tiers…). Utilisable en déclencheur de
-- ligne (UPDATE / DELETE) comme d'instruction (TRUNCATE).
create or replace function private.reject_modification()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception '% on public.% is not allowed (append-only or protected table)', tg_op, tg_table_name
    using errcode = 'P0001';
end;
$$;

comment on function private.reject_modification() is
  'Déclencheur bloquant : refuse UPDATE / DELETE / TRUNCATE sur les tables protégées (docs/07 § 2.5, § 8.1, § 11.1).';

revoke all on function private.set_updated_at() from public, anon, authenticated;
revoke all on function private.reject_modification() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Types énumérés (07 § 1.4) — 22 types
-- ---------------------------------------------------------------------------
create type public.event_type as enum (
  'wedding', 'dowry', 'baptism', 'birthday', 'baby_presentation', 'other'
);

create type public.organizer_status as enum ('active', 'suspended');

create type public.admin_role as enum (
  'super_admin', 'marketing', 'finance', 'support', 'content'
);

-- `unpaid` = brouillon.
create type public.billing_status as enum ('unpaid', 'trial', 'paid');

create type public.table_naming as enum ('named', 'numbered');

create type public.invitation_kind as enum ('single', 'plus_one');

create type public.rsvp_status as enum ('pending', 'accepted', 'declined');

create type public.rsvp_source as enum ('guest', 'check_in');

create type public.check_in_who as enum ('both', 'main', 'companion');

-- `partial` = 1 place sur 2.
create type public.check_in_result as enum (
  'admitted', 'partial', 'already_in', 'refused_main_absent',
  'refused_strict', 'refused_other_event', 'invalid'
);

create type public.payment_kind as enum ('initial', 'upgrade', 'extra_seats', 'quote');

create type public.payment_status as enum ('pending', 'approved', 'declined', 'canceled');

create type public.refund_mode as enum ('fedapay_dashboard', 'manual_transfer');

create type public.refund_status as enum ('recorded', 'executed');

create type public.quote_status as enum ('pending', 'quoted', 'paid', 'canceled');

create type public.wa_category as enum ('marketing', 'utility', 'authentication', 'service');

create type public.wa_purpose as enum (
  'invitation', 'invitation_resend', 'ticket', 'reminder_auto', 'reminder_manual',
  'event_update', 'thank_you', 'host_message', 'login_code', 'auto_reply'
);

create type public.wa_status as enum (
  'queued', 'sending', 'sent', 'delivered', 'read', 'failed', 'canceled'
);

create type public.schedule_kind as enum ('bulk_send', 'reminder_auto', 'event_update');

create type public.schedule_status as enum ('pending', 'done', 'canceled');

create type public.promo_kind as enum ('percent', 'fixed', 'tracking_only');

create type public.optout_source as enum ('button', 'stop_reply', 'blocked');
