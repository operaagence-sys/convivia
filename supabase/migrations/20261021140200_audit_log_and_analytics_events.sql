-- Tranche 1 — socle (3/5) : journal d'audit (ajout seul) et journal
-- d'événements produit (écrit par le serveur seulement, sans donnée
-- personnelle).
-- Sources : docs/07-schema-backend.md § 2.5, § 11.1, § 16 ; docs/06-trd.md
-- § 8.4, § 13.5 ; docs/09-conventions.md § 1.4.
--
-- Pas de tables admin en tranche 1 (décision C6) : la lecture SA de audit_log
-- et les vues d'agrégats sur analytics_events (admin_funnel_v, admin_usage_v,
-- admin_growth_v) viendront par une nouvelle migration (tranches 8 / 15).
-- `actor_id` n'a pas de clé étrangère : il désigne un admin ou un
-- organisateur, et le journal doit survivre à leur suppression (07 § 16).

-- ---------------------------------------------------------------------------
-- 1. audit_log (07 § 2.5) — ajout seul
-- ---------------------------------------------------------------------------
create table public.audit_log (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  actor_id uuid,
  actor_kind text not null,
  action text not null,
  target_table text,
  target_id uuid,
  details jsonb not null default '{}'::jsonb,
  ip_hash text,
  constraint audit_log_actor_kind_check check (actor_kind in ('admin', 'organizer', 'system')),
  -- « nul si système » ; un acte admin ou organisateur est toujours attribué.
  constraint audit_log_actor_consistency check ((actor_kind = 'system') = (actor_id is null)),
  constraint audit_log_action_format check (action ~ '^[a-z][a-z_]*(\.[a-z][a-z_]*)+$'),
  constraint audit_log_target_table_format check (target_table is null or target_table ~ '^[a-z][a-z0-9_]*$'),
  constraint audit_log_details_is_object check (jsonb_typeof(details) = 'object'),
  -- Empreinte HMAC-SHA256 en hexadécimal, comme phone_hash (07 § 1.5).
  constraint audit_log_ip_hash_format check (ip_hash is null or ip_hash ~ '^[0-9a-f]{64}$')
);

comment on table public.audit_log is
  'Journal des actes sensibles, en ajout seul (UPDATE / DELETE / TRUNCATE refusés par déclencheur). Jamais de coordonnées d''invité dans details (docs/07 § 2.5).';
comment on column public.audit_log.actor_id is
  'Admin ou organisateur ; nul si système. Sans clé étrangère (conservation, docs/07 § 16).';
comment on column public.audit_log.details is
  'Montant, motif, référence… JAMAIS de nom ni de numéro d''invité.';

create trigger audit_log_reject_update_delete
  before update or delete on public.audit_log
  for each row execute function private.reject_modification();

create trigger audit_log_reject_truncate
  before truncate on public.audit_log
  for each statement execute function private.reject_modification();

alter table public.audit_log enable row level security;

-- Aucune politique : anon et authenticated n'ont rien. Serveur : INSERT seul.
revoke all on table public.audit_log from anon, authenticated, service_role;
revoke all on sequence public.audit_log_id_seq from anon, authenticated, service_role;
grant insert on table public.audit_log to service_role;

-- ---------------------------------------------------------------------------
-- 2. analytics_events (07 § 11.1, S7)
-- ---------------------------------------------------------------------------
-- Liste blanche des clés de `properties` : limitée aux exemples de 07 § 11.1
-- (palier, template, canal, montant arrondi), étendue tranche par tranche par
-- une nouvelle migration. Valeurs scalaires au format contraint : aucune
-- chaîne libre (un nom ou un numéro ne passe pas).
create table public.analytics_events (
  id bigint generated always as identity primary key,
  name text not null,
  occurred_at timestamptz not null default now(),
  organizer_ref uuid,
  event_ref uuid,
  invitation_ref uuid,
  event_type public.event_type,
  country_code char(2),
  city text,
  properties jsonb not null default '{}'::jsonb,
  constraint analytics_events_name_check check (name in (
    'organizer.signed_up',
    'event.created',
    'design.template_chosen',
    'payment.started',
    'payment.approved',
    'payment.failed',
    'trial.claimed',
    'invitations.sent',
    'invitation.opened',
    'rsvp.answered',
    'check_in.admitted',
    'thank_you.sent'
  )),
  constraint analytics_events_country_code_format check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  constraint analytics_events_properties_is_object check (jsonb_typeof(properties) = 'object'),
  constraint analytics_events_properties_allowed_keys check (
    (properties - array['tier_seats', 'template_slug', 'channel', 'amount_rounded']) = '{}'::jsonb
  ),
  constraint analytics_events_properties_values check (
    (
      properties -> 'tier_seats' is null
      or (jsonb_typeof(properties -> 'tier_seats') = 'number'
          and (properties ->> 'tier_seats') ~ '^[1-9][0-9]{0,6}$')
    )
    and (
      properties -> 'template_slug' is null
      or (jsonb_typeof(properties -> 'template_slug') = 'string'
          and (properties ->> 'template_slug') ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
          and char_length(properties ->> 'template_slug') <= 64)
    )
    and (
      properties -> 'channel' is null
      or (jsonb_typeof(properties -> 'channel') = 'string'
          and (properties ->> 'channel') ~ '^[a-z0-9_-]{1,64}$')
    )
    and (
      properties -> 'amount_rounded' is null
      or (jsonb_typeof(properties -> 'amount_rounded') = 'number'
          and (properties ->> 'amount_rounded') ~ '^[0-9]{1,12}$')
    )
  )
);

comment on table public.analytics_events is
  'Faits marquants produit, écrits par le serveur seulement, sans donnée personnelle. Lus via des vues d''agrégats (docs/07 § 11.1, docs/06 § 13.5).';
comment on column public.analytics_events.organizer_ref is 'Copie de l''identifiant, sans clé étrangère (docs/07 § 1.2 règle 7).';
comment on column public.analytics_events.event_ref is 'Copie de l''identifiant, sans clé étrangère.';
comment on column public.analytics_events.invitation_ref is
  'Copie de l''identifiant ; seule colonne modifiable, et seulement vers NULL (suppression de l''invité ou de l''événement, docs/07 § 16).';
comment on column public.analytics_events.properties is
  'Clés autorisées : tier_seats (entier), template_slug (slug), channel (slug), amount_rounded (entier FCFA).';

-- UPDATE refusé sauf la mise à nul de invitation_ref (toutes les autres
-- colonnes inchangées) ; DELETE refusé.
create or replace function private.analytics_events_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
     and new.invitation_ref is null
     and (to_jsonb(new) - 'invitation_ref') = (to_jsonb(old) - 'invitation_ref') then
    return new;
  end if;
  raise exception '% on public.analytics_events is not allowed (only clearing invitation_ref)', tg_op
    using errcode = 'P0001';
end;
$$;

comment on function private.analytics_events_guard() is
  'Déclencheur : analytics_events en ajout seul, sauf invitation_ref mise à NULL (docs/07 § 11.1, § 16).';

revoke all on function private.analytics_events_guard() from public, anon, authenticated;

create trigger analytics_events_guard_update_delete
  before update or delete on public.analytics_events
  for each row execute function private.analytics_events_guard();

create trigger analytics_events_reject_truncate
  before truncate on public.analytics_events
  for each statement execute function private.reject_modification();

alter table public.analytics_events enable row level security;

-- Aucune politique : anon et authenticated n'ont rien. Serveur : INSERT seul
-- (la mise à nul de invitation_ref passera par delete_event /
-- delete_organizer_account, SECURITY DEFINER, tranche 14).
revoke all on table public.analytics_events from anon, authenticated, service_role;
revoke all on sequence public.analytics_events_id_seq from anon, authenticated, service_role;
grant insert on table public.analytics_events to service_role;
