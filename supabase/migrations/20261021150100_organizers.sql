-- Tranche 2 — connexion (2/4) : profil organisateur, exclusivité
-- organisateur / admin, création du profil par le serveur.
-- Sources : docs/07-schema-backend.md § 1.2 (règles 1, 6, 8), § 1.5, § 2.1,
-- § 2.2, § 13, § 16, § 17 ; docs/06-trd.md § 7.1 à § 7.4, D23, D44, D47,
-- D51, D53, D55, D57 ; docs/01-prd.md § 4 (suspension en lecture seule).
--
-- Colonnes de 07 § 2.1 créées ICI : id, full_name, email, country_code, city,
-- status, suspended_at, suspended_by, suspension_reason, created_at,
-- updated_at.
-- Colonnes de 07 § 2.1 NON créées ici (ajoutées par la tranche qui les écrit,
-- avec leurs contraintes et leurs droits) :
-- - acquisition_link_id : tranche 13 (D57 : en tranche 2, ?ref= est seulement
--   conservé dans la redirection /signup → /login). Créée en tranche 13 avec
--   sa clé étrangère vers tracking_links (ON DELETE SET NULL), dans la même
--   migration que tracking_links : pas de colonne sans contrainte, que rien
--   n'écrit et que le serveur pourrait remplir d'un identifiant invalide.
-- - posthog_distinct_id : tranche 13 (PostHog), même raison.
-- - phone_e164, phone_verified_at : tranche 5 (D48 : numéro vérifié au moment
--   de demander l'essai), avec le contrôle E.164 et D53 (indicatifs des pays
--   actifs).
--
-- Écart assumé avec 07 § 2.1 : email est NOT NULL (07 : « peut être nul,
-- compte téléphone »). Depuis D47, tout organisateur se connecte par e-mail ;
-- l'e-mail est recopié de auth.users par ensure_organizer() et n'est jamais
-- modifié ensuite (D51).
--
-- Création de la ligne : par le serveur, À LA VÉRIFICATION DU CODE, APRÈS le
-- contrôle admin (product-manager, tranche 2), via ensure_organizer() — et
-- non par un déclencheur sur auth.users. Le profil (nom, ville, pays) est
-- saisi ensuite par l'organisateur (D44).

-- ---------------------------------------------------------------------------
-- 1. organizers (07 § 2.1)
-- ---------------------------------------------------------------------------
create table public.organizers (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  email text not null,
  country_code char(2) references public.countries (code),
  city text,
  status public.organizer_status not null default 'active',
  suspended_at timestamptz,
  suspended_by uuid references public.admin_users (user_id),
  suspension_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organizers_email_key unique (email),
  constraint organizers_email_format check (
    email = lower(email)
    and char_length(email) <= 254
    and email ~ '^[^@[:space:][:cntrl:]]+@[^@[:space:][:cntrl:]]+\.[^@[:space:][:cntrl:]]+$'
  ),
  -- Proposition D55 (à valider par le porteur du projet) : 2 à 80 caractères,
  -- sans espace en bord, sans double espace, sans caractère de contrôle (ni
  -- retour à la ligne ni tabulation, refusés par Meta dans une variable de
  -- modèle : le nom signe « De la part de … »), au moins une lettre.
  constraint organizers_full_name_format check (
    full_name is null or (
      char_length(full_name) between 2 and 80
      and full_name ~ '^\S(.*\S)?$'
      and full_name !~ '[[:cntrl:]]'
      and full_name !~ '\s\s'
      and full_name ~ '[[:alpha:]]'
    )
  ),
  -- Ville libre (D55) : 2 à 60 caractères, mêmes règles de format.
  constraint organizers_city_format check (
    city is null or (
      char_length(city) between 2 and 60
      and city ~ '^\S(.*\S)?$'
      and city !~ '[[:cntrl:]]'
      and city !~ '\s\s'
      and city ~ '[[:alpha:]]'
    )
  ),
  constraint organizers_suspension_consistency check (status = 'active' or suspended_at is not null),
  constraint organizers_suspension_reason_length check (
    suspension_reason is null or char_length(suspension_reason) <= 2000
  )
);

comment on table public.organizers is
  'Profil organisateur, une ligne par compte auth.users, créée par le serveur à la vérification du code (ensure_organizer). L''organisateur lit sa ligne et ne modifie que full_name, city, country_code, et seulement si status = active (docs/07 § 2.1, § 1.2 règle 6).';
comment on column public.organizers.full_name is
  'Saisi après le premier code (D44), signe « De la part de … ». Nul tant que le profil n''est pas rempli. 2 à 80 caractères (proposition D55).';
comment on column public.organizers.email is
  'Copie en minuscules de auth.users.email, écrite par ensure_organizer() ; jamais modifiée (D51), aucun droit UPDATE.';
comment on column public.organizers.country_code is
  'Pays de l''organisateur, parmi les pays actifs (D53, contrôlé par déclencheur à chaque changement). Nul tant que le profil n''est pas rempli.';
comment on column public.organizers.city is
  'Ville libre (D55), 2 à 60 caractères ; sert la répartition par ville.';
comment on column public.organizers.status is
  'active / suspended (S3). Suspendu : lecture conservée, aucune écriture ni envoi. Modifié seulement par suspend_organizer() / reactivate_organizer() (tranche 8).';
comment on column public.organizers.suspended_by is
  'Super-admin auteur de la suspension. Non lisible par l''organisateur (aucun GRANT SELECT sur cette colonne).';
comment on column public.organizers.suspension_reason is
  'Motif interne de la suspension. Non lisible par l''organisateur (aucun GRANT SELECT sur cette colonne).';

create index organizers_country_code_idx on public.organizers (country_code);
create index organizers_suspended_by_idx on public.organizers (suspended_by);

create trigger organizers_set_updated_at
  before update on public.organizers
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- 2. Pays actif (D53)
-- ---------------------------------------------------------------------------
-- La clé étrangère garantit que le pays existe ; le déclencheur exige en plus
-- qu'il soit ACTIF quand country_code est posé ou changé (un pays fermé plus
-- tard ne bloque pas la modification du nom ou de la ville).
-- SECURITY INVOKER : un organisateur lit countries (pays actifs, RLS) ;
-- service_role et postgres contournent RLS, d'où le test explicite is_active.
create function private.organizers_check_country_active()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.country_code is not null
     and (tg_op = 'INSERT' or new.country_code is distinct from old.country_code)
     and not exists (
       select 1 from public.countries c
       where c.code = new.country_code and c.is_active
     ) then
    raise exception 'country % is not an active country', new.country_code
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

comment on function private.organizers_check_country_active() is
  'Déclencheur BEFORE INSERT / UPDATE OF country_code sur organizers : le pays doit être actif (D53 ; docs/07 § 3.1).';

revoke all on function private.organizers_check_country_active() from public, anon, authenticated, service_role;

create trigger organizers_check_country_active
  before insert or update of country_code on public.organizers
  for each row execute function private.organizers_check_country_active();

-- ---------------------------------------------------------------------------
-- 3. Exclusivité organisateur / admin, dans les deux sens (07 § 2.2)
-- ---------------------------------------------------------------------------
-- Un même auth.users ne peut pas être à la fois organisateur et admin : un
-- compte admin connecté par code e-mail sur /login contournerait le mot de
-- passe et le TOTP (D13, D33 ; TRD § 7.1).
-- SECURITY DEFINER : le contrôle lit l'autre table quel que soit l'appelant.
-- Verrou consultatif de transaction sur l'identifiant (même clé dans les deux
-- déclencheurs) : deux transactions simultanées (création d'organisateur et
-- d'admin pour le même compte) sont sérialisées ; la seconde voit la ligne de
-- la première une fois celle-ci validée (READ COMMITTED : nouvelle image à
-- chaque instruction). Classe 1001 = exclusivité des types de compte.
create function private.organizers_reject_admin_account()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(1001, hashtext(new.id::text));
  if exists (select 1 from public.admin_users a where a.user_id = new.id) then
    raise exception 'account % is an admin account and cannot be an organizer', new.id
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

comment on function private.organizers_reject_admin_account() is
  'Déclencheur BEFORE INSERT / UPDATE OF id sur organizers : refuse un compte présent dans admin_users (docs/07 § 2.2 ; docs/06 § 8.1).';

create function private.admin_users_reject_organizer_account()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(1001, hashtext(new.user_id::text));
  if exists (select 1 from public.organizers o where o.id = new.user_id) then
    raise exception 'account % is an organizer account and cannot be an admin', new.user_id
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

comment on function private.admin_users_reject_organizer_account() is
  'Déclencheur BEFORE INSERT / UPDATE OF user_id sur admin_users : refuse un compte présent dans organizers (docs/07 § 2.2 ; docs/06 § 8.1).';

revoke all on function private.organizers_reject_admin_account() from public, anon, authenticated, service_role;
revoke all on function private.admin_users_reject_organizer_account() from public, anon, authenticated, service_role;

create trigger organizers_reject_admin_account
  before insert or update of id on public.organizers
  for each row execute function private.organizers_reject_admin_account();

create trigger admin_users_reject_organizer_account
  before insert or update of user_id on public.admin_users
  for each row execute function private.admin_users_reject_organizer_account();

-- ---------------------------------------------------------------------------
-- 4. RLS et droits (07 § 2.1, § 1.2 règles 1, 6, 8)
-- ---------------------------------------------------------------------------
alter table public.organizers enable row level security;

revoke all on table public.organizers from anon, authenticated, service_role;

-- Organisateur : lecture de sa ligne, sans suspended_by ni suspension_reason
-- (identifiant d'admin et motif interne). Conséquence pour le client :
-- « select * » est refusé, lister les colonnes.
grant select (id, full_name, email, country_code, city, status, suspended_at, created_at, updated_at)
  on public.organizers to authenticated;
-- Organisateur : modification de son profil seulement (D44, 07 § 2.1). Ni
-- email (D51), ni status / suspended_*, ni colonnes de facturation.
grant update (full_name, city, country_code) on public.organizers to authenticated;
-- Serveur : lecture. La création passe par ensure_organizer() ; les colonnes
-- serveur des tranches 5 et 13 (numéro vérifié, canal d'acquisition)
-- recevront leur GRANT UPDATE avec leur création ; la suspension passe par
-- suspend_organizer() (tranche 8), la suppression par
-- delete_organizer_account() (tranche 14).
grant select on table public.organizers to service_role;

create policy organizers_select_own
  on public.organizers
  for select
  to authenticated
  using (id = (select auth.uid()));

-- Écriture seulement si le compte est actif (règle 6) ; la ligne modifiée
-- doit garder un profil complet (nom, ville, pays : D44), ce qui empêche de
-- vider un champ déjà rempli. Un compte suspendu : UPDATE sans effet (0
-- ligne), sans erreur.
create policy organizers_update_own_active
  on public.organizers
  for update
  to authenticated
  using (id = (select auth.uid()) and status = 'active')
  with check (
    id = (select auth.uid())
    and status = 'active'
    and full_name is not null
    and city is not null
    and country_code is not null
  );

comment on policy organizers_select_own on public.organizers is
  'Organisateur : lecture de SA ligne seulement (id = auth.uid()), suspendu compris (docs/07 § 2.1, S9).';
comment on policy organizers_update_own_active on public.organizers is
  'Organisateur ACTIF : modification de sa ligne (colonnes full_name, city, country_code accordées), profil complet exigé (docs/07 § 2.1, § 1.2 règle 6 ; D44).';

-- ---------------------------------------------------------------------------
-- 5. ensure_organizer(p_user_id) — serveur seulement
-- ---------------------------------------------------------------------------
-- Appelée par la route serveur de /verify APRÈS un code juste. Contrôles,
-- dans l'ordre : compte auth.users existant, non anonyme, e-mail confirmé
-- (la vérification a eu lieu) ; compte non admin (sinon erreur
-- « admin_account » : le serveur ferme la session et affiche le message
-- neutre, D23). Crée la ligne si elle manque, e-mail recopié de auth.users
-- (le serveur ne peut pas en fournir un autre). Idempotente (deux
-- vérifications simultanées : une seule création).
-- Renvoie : created (ligne créée par cet appel), profile_complete (nom, ville
-- et pays remplis ; sinon rediriger vers l'écran de profil, D44),
-- organizer_status (suspendu : connexion possible, lecture seule).
create function public.ensure_organizer(p_user_id uuid)
returns table (created boolean, profile_complete boolean, organizer_status public.organizer_status)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_email text;
  v_email_confirmed_at timestamptz;
  v_is_anonymous boolean;
  v_created boolean;
begin
  if p_user_id is null then
    raise exception 'p_user_id is required' using errcode = '22004';
  end if;

  select u.email, u.email_confirmed_at, u.is_anonymous
    into v_email, v_email_confirmed_at, v_is_anonymous
    from auth.users u
    where u.id = p_user_id;

  if not found then
    raise exception 'unknown_user' using errcode = 'P0002';
  end if;

  if v_is_anonymous or v_email is null or v_email_confirmed_at is null then
    raise exception 'user_not_verified' using errcode = 'P0001';
  end if;

  if exists (select 1 from public.admin_users a where a.user_id = p_user_id) then
    raise exception 'admin_account' using errcode = 'P0001';
  end if;

  insert into public.organizers (id, email)
    values (p_user_id, lower(btrim(v_email)))
    on conflict on constraint organizers_pkey do nothing;
  v_created := found;

  return query
    select v_created,
           (o.full_name is not null and o.city is not null and o.country_code is not null),
           o.status
    from public.organizers o
    where o.id = p_user_id;
end;
$$;

comment on function public.ensure_organizer(uuid) is
  'Serveur seulement (service_role), après un code juste : crée la ligne organizers si elle manque (e-mail recopié de auth.users), refuse un compte admin (« admin_account »), un compte inconnu (« unknown_user ») ou non vérifié (« user_not_verified »). Renvoie created, profile_complete, organizer_status (docs/07 § 2.1, § 2.2 ; docs/06 § 7.1, D23, D44).';

revoke all on function public.ensure_organizer(uuid) from public, anon, authenticated;
grant execute on function public.ensure_organizer(uuid) to service_role;
