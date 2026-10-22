-- Tranche 2 — connexion (5/5) : inscription mesurée dans analytics_events.
-- Sources : décisions du porteur du projet du 2026-10-21 (points 1 et 5) ;
-- docs/07-schema-backend.md § 11.1 (S7) ; docs/06-trd.md § 13.5 ;
-- docs/09-conventions.md § 1.4.
--
-- 1. ensure_organizer() écrit « organizer.signed_up » quand ELLE CRÉE la ligne
--    organizers, et seulement alors : un appel suivant (connexion d'un compte
--    déjà inscrit) n'écrit rien. Même transaction que la création : pas
--    d'inscription sans événement, ni d'événement sans inscription. Deux
--    vérifications simultanées : la seconde attend la clé primaire, ne crée
--    rien (ON CONFLICT DO NOTHING, found = false) et n'écrit donc rien.
--    Ligne écrite : name, organizer_ref, occurred_at (défaut). Aucune donnée
--    personnelle : ni e-mail ni nom ; ville et pays inconnus à ce moment
--    (profil saisi après, D44), donc nuls ; properties vide.
--    Liste blanche NON étendue : « organizer.signed_up » figure déjà dans
--    analytics_events_name_check (20261021140200) et aucune clé de properties
--    n'est nécessaire.
-- 2. Longueurs D55 validées (nom 2 à 80, ville 2 à 60, règles de format
--    inchangées) : seuls les commentaires de colonne sont mis à jour (les
--    contraintes de 20261021150100 restent telles quelles).
--
-- Migration distincte (et non modification de 20261021150100) : le hook
-- migration-immutable refuse toute modification d'une migration qui n'est
-- pas la plus récente.

-- ---------------------------------------------------------------------------
-- 1. ensure_organizer(p_user_id) — serveur seulement
-- ---------------------------------------------------------------------------
-- Même signature et même type de retour que 20261021150100 : CREATE OR
-- REPLACE conserve le propriétaire et les droits ; ils sont réaffirmés
-- ci-dessous par prudence.
create or replace function public.ensure_organizer(p_user_id uuid)
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

  -- Inscription (07 § 11.1) : seulement à la création, sans donnée
  -- personnelle (identifiant seul, sans clé étrangère).
  if v_created then
    insert into public.analytics_events (name, organizer_ref)
      values ('organizer.signed_up', p_user_id);
  end if;

  return query
    select v_created,
           (o.full_name is not null and o.city is not null and o.country_code is not null),
           o.status
    from public.organizers o
    where o.id = p_user_id;
end;
$$;

comment on function public.ensure_organizer(uuid) is
  'Serveur seulement (service_role), après un code juste : crée la ligne organizers si elle manque (e-mail recopié de auth.users) et, à cette création seulement, écrit « organizer.signed_up » dans analytics_events (organizer_ref seul, sans donnée personnelle) ; refuse un compte admin (« admin_account »), un compte inconnu (« unknown_user ») ou non vérifié (« user_not_verified »). Renvoie created, profile_complete, organizer_status (docs/07 § 2.1, § 2.2, § 11.1 ; docs/06 § 7.1, § 13.5, D23, D44).';

revoke all on function public.ensure_organizer(uuid) from public, anon, authenticated;
grant execute on function public.ensure_organizer(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 2. Longueurs D55 validées (commentaires seulement)
-- ---------------------------------------------------------------------------
comment on column public.organizers.full_name is
  'Saisi après le premier code (D44), signe « De la part de … ». Nul tant que le profil n''est pas rempli. 2 à 80 caractères, sans espace en bord ni double espace, sans caractère de contrôle, au moins une lettre (D55, validé le 2026-10-21).';
comment on column public.organizers.city is
  'Ville libre, 2 à 60 caractères, mêmes règles de format que full_name (D55, validé le 2026-10-21) ; sert la répartition par ville.';
