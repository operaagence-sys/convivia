-- Tranche 2 — connexion (1/4) : comptes admin, table minimale, et la
-- fonction serveur « cet e-mail appartient-il à un admin ? ».
-- Sources : docs/07-schema-backend.md § 1.1, § 1.2 (règles 3 et 8), § 2.2,
-- § 13 ; docs/06-trd.md § 7.1 (comptes admin exclus du parcours
-- organisateur), § 7.2 (Send Email Hook, D50), § 8.1 (D13, D33) ;
-- docs/08-plan-implementation.md tranche 2.
--
-- Périmètre volontairement minimal (décision du pilote, tranche 2) :
-- - PAS de admin_roles, admin_role_permissions, admin_recovery_codes ni de
--   private.has_admin_role / has_any_admin_role / has_permission : ils
--   arrivent en tranche 8 avec l'administration.
-- - AUCUNE politique RLS sur admin_users en tranche 2 (serveur seulement).
--   Les politiques de 07 § 2.2 (« tout admin aal2 : SELECT de sa ligne »,
--   « SA : SELECT de toutes ») seront créées en tranche 8 avec
--   private.has_admin_role, en même temps que les écrans /admin. Aucun écran
--   ne lit cette table avant.
-- - Le déclencheur d'exclusivité organisateur / admin (07 § 2.2) est créé
--   dans la migration suivante (20261021150100), qui crée organizers : il
--   porte sur les deux tables.
--
-- Clés étrangères : 07 § 2.2 ne précise pas d'action ON DELETE pour user_id
-- ni created_by, donc action par défaut (NO ACTION) : un compte auth.users
-- d'admin ne peut pas être supprimé tant que sa ligne admin existe (un admin
-- se désactive par is_active = false, 07 § 2.2).
--
-- Droits explicites (07 § 1.2 règle 8) : anon et authenticated n'ont rien ;
-- service_role a SELECT seulement (lecture serveur). La création des admins
-- (create_admin(), tranche 8) passera par une fonction journalisée ; la
-- procédure de création du premier super-admin est une question ouverte de
-- la tranche 8 (08 § 5).

-- ---------------------------------------------------------------------------
-- 1. admin_users (07 § 2.2)
-- ---------------------------------------------------------------------------
create table public.admin_users (
  user_id uuid primary key references auth.users (id),
  full_name text not null,
  email text not null,
  is_active boolean not null default true,
  created_by uuid references public.admin_users (user_id),
  last_login_at timestamptz,
  failed_logins smallint not null default 0,
  locked_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint admin_users_email_key unique (email),
  -- Stockée en minuscules : l'unicité et la comparaison avec l'e-mail saisi
  -- sur /login sont alors insensibles à la casse sans citext.
  constraint admin_users_email_format check (
    email = lower(email)
    and char_length(email) <= 254
    and email ~ '^[^@[:space:][:cntrl:]]+@[^@[:space:][:cntrl:]]+\.[^@[:space:][:cntrl:]]+$'
  ),
  -- Même format que organizers.full_name (proposition D55 : 2 à 80
  -- caractères, sans espace en bord, sans double espace, sans caractère de
  -- contrôle, au moins une lettre).
  constraint admin_users_full_name_format check (
    char_length(full_name) between 2 and 80
    and full_name ~ '^\S(.*\S)?$'
    and full_name !~ '[[:cntrl:]]'
    and full_name !~ '\s\s'
    and full_name ~ '[[:alpha:]]'
  ),
  constraint admin_users_failed_logins_non_negative check (failed_logins >= 0),
  constraint admin_users_not_self_created check (created_by is null or created_by <> user_id)
);

comment on table public.admin_users is
  'Comptes admin (TOTP obligatoire, D13). Un admin n''a jamais de ligne organizers (déclencheur d''exclusivité, 20261021150100). Tranche 2 : serveur seulement, aucune politique ; politiques admin en tranche 8 (docs/07 § 2.2).';
comment on column public.admin_users.email is
  'Adresse de connexion admin, en minuscules, unique. Sert aussi à refuser cette adresse sur /login et dans le Send Email Hook (auth_email_is_admin).';
comment on column public.admin_users.is_active is
  'false = accès admin coupé immédiatement. Un admin désactivé reste exclu du parcours organisateur.';
comment on column public.admin_users.failed_logins is
  'Échecs de connexion admin (mot de passe et TOTP confondus), remis à 0 après une connexion réussie ; 5 → locked_until (D33). Logique écrite en tranche 8.';
comment on column public.admin_users.locked_until is
  'Blocage de 15 min après 5 échecs (D33) ; tenu par la route serveur de /admin/login (tranche 8).';

create index admin_users_created_by_idx on public.admin_users (created_by);

create trigger admin_users_set_updated_at
  before update on public.admin_users
  for each row execute function private.set_updated_at();

alter table public.admin_users enable row level security;

-- Aucune politique : refus par défaut pour anon et authenticated (tranche 2).
revoke all on table public.admin_users from anon, authenticated, service_role;
grant select on table public.admin_users to service_role;

-- ---------------------------------------------------------------------------
-- 2. auth_email_is_admin(p_email) — serveur seulement
-- ---------------------------------------------------------------------------
-- Appelée par la route serveur de /login (avant tout envoi de code) et par
-- l'Edge Function send-auth-email (Send Email Hook, D50) : si l'adresse est
-- celle d'un admin (actif ou non), aucun code n'est envoyé et l'écran affiche
-- le même message neutre (D23, TRD § 7.1). Compare l'adresse en minuscules,
-- espaces de bord retirés, avec admin_users.email ET avec l'e-mail
-- auth.users des comptes admin (au cas où les deux divergeraient).
-- SECURITY DEFINER : service_role n'a pas besoin de lire auth.users.
-- Ne révèle rien à un client : EXECUTE accordé à service_role seulement.
create function public.auth_email_is_admin(p_email text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_email text;
begin
  if p_email is null or btrim(p_email) = '' then
    raise exception 'p_email is required' using errcode = '22004';
  end if;

  v_email := lower(btrim(p_email));

  return exists (
           select 1 from public.admin_users a where a.email = v_email
         )
      or exists (
           select 1
           from public.admin_users a
           join auth.users u on u.id = a.user_id
           where lower(u.email) = v_email
         );
end;
$$;

comment on function public.auth_email_is_admin(text) is
  'Serveur seulement (service_role) : vrai si l''e-mail (insensible à la casse) appartient à un compte admin, actif ou non. /login et le Send Email Hook n''envoient alors aucun code, avec le même message neutre (docs/06 § 7.1, D23, D50 ; docs/07 § 2.2).';

revoke all on function public.auth_email_is_admin(text) from public, anon, authenticated;
grant execute on function public.auth_email_is_admin(text) to service_role;
