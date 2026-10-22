-- Tranche 2 — refonte de la connexion (1/2) : hooks d'authentification.
-- Sources : décision du porteur du projet du 2026-10-22 (« Convivia fabrique
-- et vérifie lui-même le code ; Supabase Auth ne sert plus qu'à créer la
-- session ») ; revue de conception du security-reviewer (changements
-- obligatoires 5 et 6) ; docs/06-trd.md § 7.1, § 7.2, § 8.1, D13, D23, D33,
-- D47, D50 ; docs/07-schema-backend.md § 1.2 (règles 4, 8), § 2.1, § 2.2 ;
-- doc Supabase « Auth Hooks », « Custom Access Token Hook », « Send Email
-- Hook » (consultées le 2026-10-22).
--
-- Nouveau parcours (côté Node, frontend-developer) : le code à 6 chiffres est
-- tiré dans Node, son empreinte HMAC est confiée à login_code_issue
-- (migration suivante), l'e-mail part par Resend depuis Node. Quand
-- login_code_verify renvoie « ok », le serveur crée le compte si besoin
-- (auth.admin.createUser, e-mail confirmé), obtient un jeton à usage unique
-- (auth.admin.generateLink type magiclink, qui n'envoie rien) et l'échange
-- tout de suite contre une session (verifyOtp({ token_hash }) en POST) :
-- Supabase Auth inscrit alors la méthode « otp » dans amr et dans
-- authentication_method.
--
-- 1. auth_hooks.custom_access_token — RÉÉCRIT (remplace 20261022100000 et
--    20261022100300 s'ils ont été appliqués) :
--    - compte NON admin (organisateur, ou compte créé à l'instant par le
--      serveur, sans ligne organizers) : authentication_method « otp » ou
--      « token_refresh », et CHAQUE méthode de amr = « otp ». « magiclink »
--      et « email/signup » ne sont PLUS acceptés : ils ne viennent que du
--      parcours GET /verify (lien) ou d'une inscription Supabase, que
--      Convivia n'utilise plus. « password », « recovery », « oauth »,
--      « invite », « totp », « anonymous », « web3 »… et toute méthode future
--      restent refusés ;
--    - admin ACTIF : « password », « totp » (et « token_refresh »), amr ⊆
--      {password, totp} ; admin DÉSACTIVÉ : aucun jeton (rafraîchissement
--      compris) ;
--    - plus AUCUN ticket : le hook ne lit ni n'écrit aucune table de
--      connexion (les tickets d'envoi et de vérification sont supprimés par
--      la migration suivante) ; il redevient STABLE ;
--    - ne lit JAMAIS user_metadata (modifiable par l'utilisateur) : la seule
--      source du type de compte est public.admin_users ;
--    - échec fermé et réponse neutre inchangés.
-- 2. auth_hooks.send_email — NOUVEAU Send Email Hook en fonction Postgres :
--    refuse TOUT envoi, quel que soit le type (signup, magiclink, recovery,
--    invite, email_change, reauthentication, notifications… et types
--    futurs), sans même lire l'événement. Supabase Auth n'envoie donc plus
--    aucun e-mail : un appel direct à /auth/v1/otp, /recover, /resend ou
--    /invite n'aboutit à rien (D23 : réponse identique pour toutes les
--    adresses). Il remplace l'Edge Function send-auth-email (à supprimer par
--    le porteur du projet). Aucun SMTP personnalisé ne doit être réglé (le
--    hook a priorité, mais un SMTP reprendrait la main si le hook était
--    désactivé).
--    SECURITY INVOKER (et non DEFINER) : la fonction ne lit aucune table et
--    n'a besoin d'aucun droit ; le moindre privilège suffit.
--
-- Emplacement et droits : schéma auth_hooks (hors public, non exposé par
-- l'API), USAGE et EXECUTE pour supabase_auth_admin SEULEMENT ; rien pour
-- anon, authenticated ni service_role. « create schema if not exists » : la
-- migration s'applique que 20261022100000 ait été appliquée ou supprimée.
--
-- ACTIVATION (réglages du tableau de bord, hors migration, par le porteur du
-- projet) : Authentication → Hooks →
-- - Custom Access Token : Postgres, schéma auth_hooks, fonction
--   custom_access_token (pg-functions://postgres/auth_hooks/custom_access_token) ;
-- - Send Email : Postgres, schéma auth_hooks, fonction send_email
--   (pg-functions://postgres/auth_hooks/send_email), À LA PLACE de l'Edge
--   Function send-auth-email.

-- ---------------------------------------------------------------------------
-- 1. Schéma dédié
-- ---------------------------------------------------------------------------
create schema if not exists auth_hooks;

comment on schema auth_hooks is
  'Hooks d''authentification Supabase Auth (Postgres) : custom_access_token et send_email. Non exposé par l''API ; USAGE pour supabase_auth_admin seulement.';

revoke all on schema auth_hooks from public;
grant usage on schema auth_hooks to supabase_auth_admin;

-- ---------------------------------------------------------------------------
-- 2. auth_hooks.custom_access_token(event) — organisateur « otp » seulement
-- ---------------------------------------------------------------------------
create or replace function auth_hooks.custom_access_token(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  c_organizer_methods constant text[] := array['otp'];
  c_admin_methods constant text[] := array['password', 'totp'];
  c_denied constant jsonb := jsonb_build_object(
    'error', jsonb_build_object('http_code', 403, 'message', 'access_denied')
  );
  v_claims jsonb;
  v_amr jsonb;
  v_user_id uuid;
  v_method text;
  v_amr_methods text[];
  v_allowed text[];
  v_admin_active boolean;
begin
  -- Forme de l'événement (échec fermé).
  if event is null or jsonb_typeof(event) is distinct from 'object' then
    return c_denied;
  end if;

  v_claims := event -> 'claims';
  if jsonb_typeof(v_claims) is distinct from 'object' then
    return c_denied;
  end if;

  if jsonb_typeof(event -> 'user_id') is distinct from 'string'
     or (event ->> 'user_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return c_denied;
  end if;
  v_user_id := (event ->> 'user_id')::uuid;

  if jsonb_typeof(v_claims -> 'sub') is distinct from 'string'
     or lower(v_claims ->> 'sub') is distinct from v_user_id::text then
    return c_denied;
  end if;

  if jsonb_typeof(event -> 'authentication_method') is distinct from 'string' then
    return c_denied;
  end if;
  v_method := event ->> 'authentication_method';

  -- Comptes anonymes : désactivés dans le projet, refusés ici aussi.
  if jsonb_typeof(v_claims -> 'is_anonymous') = 'boolean'
     and (v_claims -> 'is_anonymous') = 'true'::jsonb then
    return c_denied;
  end if;

  v_amr := v_claims -> 'amr';
  if jsonb_typeof(v_amr) is distinct from 'array' or jsonb_array_length(v_amr) = 0 then
    return c_denied;
  end if;
  if exists (
    select 1
    from jsonb_array_elements(v_amr) as e(entry)
    where jsonb_typeof(e.entry) is distinct from 'object'
       or jsonb_typeof(e.entry -> 'method') is distinct from 'string'
  ) then
    return c_denied;
  end if;
  v_amr_methods := array(
    select e.entry ->> 'method' from jsonb_array_elements(v_amr) as e(entry)
  );

  -- Type de compte : public.admin_users seulement (jamais user_metadata).
  select a.is_active into v_admin_active
    from public.admin_users a
    where a.user_id = v_user_id;

  if found then
    if v_admin_active is not true then
      return c_denied;
    end if;
    v_allowed := c_admin_methods;
  else
    v_allowed := c_organizer_methods;
  end if;

  if v_method <> 'token_refresh' and not (v_method = any (v_allowed)) then
    return c_denied;
  end if;
  if not (v_amr_methods <@ v_allowed) then
    return c_denied;
  end if;

  return jsonb_build_object('claims', v_claims);
end;
$$;

comment on function auth_hooks.custom_access_token(jsonb) is
  'Custom Access Token Hook (Supabase Auth, à chaque émission et rafraîchissement de jeton). Compte non admin : « otp » seulement (session créée par le serveur après login_code_verify = ok) ; admin actif : password et totp seulement ; admin désactivé : refusé. Contrôle authentication_method (hors token_refresh) et chaque méthode de amr ; type de compte lu dans admin_users seulement, jamais user_metadata ; aucun ticket ; événement mal formé refusé (échec fermé). Claims renvoyés inchangés ; refus = {"error":{"http_code":403,"message":"access_denied"}} (docs/06 § 7.1, § 8.1, D13, D33, D47 ; décision du 2026-10-22).';

revoke all on function auth_hooks.custom_access_token(jsonb) from public, anon, authenticated, service_role;
grant execute on function auth_hooks.custom_access_token(jsonb) to supabase_auth_admin;

-- ---------------------------------------------------------------------------
-- 3. auth_hooks.send_email(event) — refuse tout envoi
-- ---------------------------------------------------------------------------
-- L'événement n'est pas lu : la réponse est la même pour tous les types,
-- toutes les adresses et tout contenu, y compris nul ou mal formé.
create function auth_hooks.send_email(event jsonb)
returns jsonb
language sql
immutable
security invoker
set search_path = ''
as $$
  select '{"error": {"http_code": 403, "message": "email_sending_disabled"}}'::jsonb
$$;

comment on function auth_hooks.send_email(jsonb) is
  'Send Email Hook (Supabase Auth) : refuse TOUS les envois, quel que soit le type (y compris futurs), sans lire l''événement. Les codes de connexion sont fabriqués, vérifiés et envoyés par Convivia (Node + Resend, login_code_issue / login_code_verify) ; Supabase Auth ne sert qu''à créer la session. Réponse fixe {"error":{"http_code":403,"message":"email_sending_disabled"}} (décision du 2026-10-22 ; revue de conception security-reviewer).';

revoke all on function auth_hooks.send_email(jsonb) from public, anon, authenticated, service_role;
grant execute on function auth_hooks.send_email(jsonb) to supabase_auth_admin;
