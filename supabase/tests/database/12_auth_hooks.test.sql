-- Tranche 2 — refonte de la connexion : hooks d'authentification
-- (auth_hooks.custom_access_token et auth_hooks.send_email, migration
-- 20261022120000).
-- Sources : revue de conception du security-reviewer (changements 5 et 6) ;
-- décision du porteur du projet du 2026-10-22 ; docs/06 § 7.1, § 8.1, D13,
-- D23, D33, D47, D50 ; docs/07 § 2.1, § 2.2.
-- Les événements imitent ceux de Supabase Auth (doc « Custom Access Token
-- Hook », « Send Email Hook ») ; les fonctions sont appelées en tant que
-- postgres (propriétaire), car postgres ne peut pas prendre le rôle
-- supabase_auth_admin : les droits de celui-ci sont vérifiés par
-- has_function_privilege. Données fictives (domaine réservé example.com) ;
-- tout est annulé.
begin;
create extension if not exists pgtap with schema extensions;

select plan(65);

-- Données de test ---------------------------------------------------------------
insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-4000-8000-00000000c001', 'nouveau.compte@example.com', now()),
  ('00000000-0000-4000-8000-00000000c002', 'organisateur.inscrit@example.com', now()),
  ('00000000-0000-4000-8000-00000000c0a1', 'admin.actif@example.com', now()),
  ('00000000-0000-4000-8000-00000000c0a2', 'admin.desactive@example.com', now());

insert into public.organizers (id, email)
  values ('00000000-0000-4000-8000-00000000c002', 'organisateur.inscrit@example.com');

insert into public.admin_users (user_id, full_name, email, is_active) values
  ('00000000-0000-4000-8000-00000000c0a1', 'Admin Actif', 'admin.actif@example.com', true),
  ('00000000-0000-4000-8000-00000000c0a2', 'Admin Desactive', 'admin.desactive@example.com', false);

-- Événement de Supabase Auth : p_amr = méthodes de la session, de la plus
-- récente à la plus ancienne, comme dans les jetons.
create function pg_temp.evt(p_user text, p_method text, p_amr text[])
returns jsonb
language sql
as $$
  select jsonb_build_object(
    'user_id', p_user,
    'authentication_method', p_method,
    'claims', jsonb_build_object(
      'aud', 'authenticated',
      'exp', 1900000000,
      'iat', 1899996400,
      'sub', p_user,
      'email', 'fictif@example.com',
      'phone', '',
      'app_metadata', jsonb_build_object('provider', 'email'),
      'user_metadata', '{}'::jsonb,
      'role', 'authenticated',
      'aal', 'aal1',
      'amr', coalesce(
        (select jsonb_agg(jsonb_build_object('method', m, 'timestamp', 1899996400))
         from unnest(p_amr) as m),
        '[]'::jsonb),
      'session_id', '00000000-0000-4000-8000-0000000000e1',
      'is_anonymous', false
    )
  )
$$;

-- Vrai si le hook accepte (claims renvoyés, aucune erreur).
create function pg_temp.accepted(p_event jsonb)
returns boolean
language sql
as $$
  select (r -> 'claims') is not null and (r -> 'error') is null
  from (select auth_hooks.custom_access_token(p_event) as r) as s
$$;

-- Vrai si le hook refuse avec l'erreur neutre attendue.
create function pg_temp.denied(p_event jsonb)
returns boolean
language sql
as $$
  select r = '{"error": {"http_code": 403, "message": "access_denied"}}'::jsonb
  from (select auth_hooks.custom_access_token(p_event) as r) as s
$$;

-- Événement du Send Email Hook pour un type d'e-mail donné.
create function pg_temp.mail_evt(p_type text, p_email text)
returns jsonb
language sql
as $$
  select jsonb_build_object(
    'user', jsonb_build_object('id', '00000000-0000-4000-8000-00000000c002', 'email', p_email,
                               'user_metadata', '{}'::jsonb),
    'email_data', jsonb_build_object('token', '305805', 'token_hash', 'fictif', 'redirect_to', '',
                                     'email_action_type', p_type, 'site_url', '', 'token_new', '',
                                     'token_hash_new', '')
  )
$$;

-- Compte non admin, créé par le serveur, pas encore organisateur ------------- (7)
select ok(pg_temp.accepted(pg_temp.evt('00000000-0000-4000-8000-00000000c001', 'otp', array['otp'])),
  'nouveau compte : session créée par le serveur (otp) acceptée, sans ticket');
select ok(pg_temp.denied(pg_temp.evt('00000000-0000-4000-8000-00000000c001', 'magiclink', array['magiclink'])),
  'nouveau compte : lien magique (GET /verify) refusé : « otp » seul est accepté');
select ok(pg_temp.denied(pg_temp.evt('00000000-0000-4000-8000-00000000c001', 'email/signup', array['email/signup'])),
  'nouveau compte : inscription Supabase (email/signup) refusée');
select ok(pg_temp.denied(pg_temp.evt('00000000-0000-4000-8000-00000000c001', 'password', array['password'])),
  'CRITIQUE : compte pré-créé avec mot de passe → connexion par mot de passe refusée');
select ok(pg_temp.denied(pg_temp.evt('00000000-0000-4000-8000-00000000c001', 'token_refresh', array['password'])),
  'CRITIQUE : session ouverte par mot de passe → rafraîchissement refusé');
select ok(pg_temp.accepted(pg_temp.evt('00000000-0000-4000-8000-00000000c001', 'token_refresh', array['otp'])),
  'session ouverte par otp → rafraîchissement accepté');
select ok(pg_temp.denied(pg_temp.evt('00000000-0000-4000-8000-00000000c001', 'token_refresh', array['magiclink'])),
  'session ouverte par lien magique (ancien parcours) → rafraîchissement refusé');

-- Organisateur inscrit --------------------------------------------------------- (11)
select ok(pg_temp.accepted(pg_temp.evt('00000000-0000-4000-8000-00000000c002', 'otp', array['otp'])),
  'organisateur : otp accepté');
select ok(pg_temp.accepted(pg_temp.evt('00000000-0000-4000-8000-00000000c002', 'token_refresh', array['otp'])),
  'organisateur : rafraîchissement d''une session otp accepté');
select ok(pg_temp.denied(pg_temp.evt('00000000-0000-4000-8000-00000000c002', 'password', array['password'])),
  'organisateur : mot de passe (ajouté par updateUser ou pré-créé) refusé (D47)');
select ok(pg_temp.denied(pg_temp.evt('00000000-0000-4000-8000-00000000c002', 'token_refresh', array['otp', 'password'])),
  'organisateur : amr mêlant otp et mot de passe refusé');
select ok(pg_temp.denied(pg_temp.evt('00000000-0000-4000-8000-00000000c002', 'recovery', array['recovery'])),
  'organisateur : lien de récupération (recovery) refusé');
select ok(pg_temp.denied(pg_temp.evt('00000000-0000-4000-8000-00000000c002', 'oauth', array['oauth'])),
  'organisateur : OAuth refusé');
select ok(pg_temp.denied(pg_temp.evt('00000000-0000-4000-8000-00000000c002', 'invite', array['invite'])),
  'organisateur : invitation refusée');
select ok(pg_temp.denied(pg_temp.evt('00000000-0000-4000-8000-00000000c002', 'email_change', array['email_change'])),
  'organisateur : changement d''e-mail refusé (D51)');
select ok(pg_temp.denied(pg_temp.evt('00000000-0000-4000-8000-00000000c002', 'totp', array['totp', 'otp'])),
  'organisateur : TOTP refusé (réservé aux admins)');
select ok(pg_temp.denied(pg_temp.evt('00000000-0000-4000-8000-00000000c002', 'web3', array['web3'])),
  'organisateur : méthode inconnue ou future refusée (liste autorisée)');
select ok(pg_temp.denied(pg_temp.evt('00000000-0000-4000-8000-00000000c002', 'otp', array['otp', 'magiclink'])),
  'organisateur : amr mêlant otp et lien magique refusé');

-- user_metadata n'est jamais lu ------------------------------------------------ (3)
select ok(pg_temp.accepted(jsonb_set(pg_temp.evt('00000000-0000-4000-8000-00000000c002', 'otp', array['otp']),
                                     '{claims,user_metadata}', '{"role": "admin", "is_admin": true}')),
  'organisateur : un user_metadata « admin » ne change rien (règles organisateur)');
select ok(pg_temp.denied(jsonb_set(pg_temp.evt('00000000-0000-4000-8000-00000000c0a1', 'otp', array['otp']),
                                   '{claims,user_metadata}', '{"role": "organizer", "is_admin": false}')),
  'admin : un user_metadata « organisateur » ne change rien (otp toujours refusé)');
select ok(
  -- Code only: block (/* … */) then line (-- …) comments are removed before searching, so a
  -- comment that mentions user_metadata does not make the test fail.
  (select strpos(s.code, 'user_metadata') = 0 and strpos(s.code, 'raw_user_meta_data') = 0
   from pg_catalog.pg_proc p
   cross join lateral (
     select pg_catalog.regexp_replace(
              pg_catalog.regexp_replace(p.prosrc, '/\*.*?\*/', '', 'g'),
              '--[^\n]*', '', 'g') as code
   ) as s
   where p.oid = 'auth_hooks.custom_access_token(jsonb)'::regprocedure),
  'le hook ne lit pas user_metadata (ni raw_user_meta_data)'
);

-- Admin actif --------------------------------------------------------------- (8)
select ok(pg_temp.denied(pg_temp.evt('00000000-0000-4000-8000-00000000c0a1', 'otp', array['otp'])),
  'admin → otp refusé, même juste');
select ok(pg_temp.denied(pg_temp.evt('00000000-0000-4000-8000-00000000c0a1', 'magiclink', array['magiclink'])),
  'admin → lien magique refusé');
select ok(pg_temp.denied(pg_temp.evt('00000000-0000-4000-8000-00000000c0a1', 'token_refresh', array['otp'])),
  'admin → rafraîchissement d''une session otp refusé');
select ok(pg_temp.accepted(pg_temp.evt('00000000-0000-4000-8000-00000000c0a1', 'password', array['password'])),
  'admin : mot de passe accepté (aal1, avant le TOTP)');
select ok(pg_temp.accepted(pg_temp.evt('00000000-0000-4000-8000-00000000c0a1', 'totp', array['totp', 'password'])),
  'admin : mot de passe puis TOTP accepté (aal2)');
select ok(pg_temp.accepted(pg_temp.evt('00000000-0000-4000-8000-00000000c0a1', 'token_refresh', array['totp', 'password'])),
  'admin : rafraîchissement d''une session mot de passe + TOTP accepté');
select ok(pg_temp.denied(pg_temp.evt('00000000-0000-4000-8000-00000000c0a1', 'token_refresh', array['totp', 'otp'])),
  'admin : session ouverte par otp puis TOTP refusée');
select ok(pg_temp.denied(pg_temp.evt('00000000-0000-4000-8000-00000000c0a1', 'recovery', array['recovery'])),
  'admin : recovery refusé');

-- Admin désactivé ------------------------------------------------------------ (2)
select ok(pg_temp.denied(pg_temp.evt('00000000-0000-4000-8000-00000000c0a2', 'password', array['password'])),
  'admin désactivé : mot de passe refusé (accès coupé)');
select ok(pg_temp.denied(pg_temp.evt('00000000-0000-4000-8000-00000000c0a2', 'token_refresh', array['totp', 'password'])),
  'admin désactivé : rafraîchissement refusé (accès coupé immédiatement)');

-- Claims inchangés quand le jeton est accepté --------------------------------- (1)
select is(
  auth_hooks.custom_access_token(pg_temp.evt('00000000-0000-4000-8000-00000000c002', 'otp', array['otp'])),
  jsonb_build_object('claims',
    pg_temp.evt('00000000-0000-4000-8000-00000000c002', 'otp', array['otp']) -> 'claims'),
  'jeton accepté : {"claims": …} renvoyé, claims identiques à ceux reçus'
);

-- Échec fermé : événement mal formé ------------------------------------------ (13)
select ok(pg_temp.denied(null), 'événement nul refusé');
select ok(pg_temp.denied('[]'::jsonb), 'événement qui n''est pas un objet refusé');
select ok(pg_temp.denied(pg_temp.evt('00000000-0000-4000-8000-00000000c002', 'otp', array['otp']) - 'claims'),
  'claims absent refusé');
select ok(pg_temp.denied(pg_temp.evt('00000000-0000-4000-8000-00000000c002', 'otp', array['otp']) - 'user_id'),
  'user_id absent refusé');
select ok(pg_temp.denied(jsonb_set(pg_temp.evt('00000000-0000-4000-8000-00000000c002', 'otp', array['otp']),
                                   '{user_id}', '"pas-un-uuid"')),
  'user_id qui n''est pas un UUID refusé (sans exception)');
select ok(pg_temp.denied(jsonb_set(pg_temp.evt('00000000-0000-4000-8000-00000000c002', 'otp', array['otp']),
                                   '{claims,sub}', '"00000000-0000-4000-8000-00000000c0a1"')),
  'sub différent de user_id refusé');
select ok(pg_temp.denied(pg_temp.evt('00000000-0000-4000-8000-00000000c002', 'otp', array['otp']) - 'authentication_method'),
  'authentication_method absent refusé');
select ok(pg_temp.denied(pg_temp.evt('00000000-0000-4000-8000-00000000c002', 'otp', array[]::text[])),
  'amr vide refusé');
select ok(pg_temp.denied(pg_temp.evt('00000000-0000-4000-8000-00000000c002', 'otp', array['otp']) #- '{claims,amr}'),
  'amr absent refusé');
select ok(pg_temp.denied(jsonb_set(pg_temp.evt('00000000-0000-4000-8000-00000000c002', 'otp', array['otp']),
                                   '{claims,amr}', '"otp"')),
  'amr qui n''est pas un tableau refusé');
select ok(pg_temp.denied(jsonb_set(pg_temp.evt('00000000-0000-4000-8000-00000000c002', 'otp', array['otp']),
                                   '{claims,amr}', '[{"timestamp": 1}]')),
  'entrée amr sans méthode refusée');
select ok(pg_temp.denied(jsonb_set(pg_temp.evt('00000000-0000-4000-8000-00000000c002', 'otp', array['otp']),
                                   '{claims,is_anonymous}', 'true')),
  'compte anonyme refusé');
select ok(pg_temp.denied(pg_temp.evt('00000000-0000-4000-8000-00000000c002', 'anonymous', array['anonymous'])),
  'méthode anonymous refusée');

-- Aucun ticket, aucune écriture ---------------------------------------------- (2)
select is(
  (select p.provolatile::text from pg_catalog.pg_proc p
   where p.oid = 'auth_hooks.custom_access_token(jsonb)'::regprocedure),
  's',
  'hook de jeton STABLE : il ne peut rien écrire'
);
select ok(
  (select strpos(p.prosrc, 'login_') = 0 from pg_catalog.pg_proc p
   where p.oid = 'auth_hooks.custom_access_token(jsonb)'::regprocedure),
  'hook de jeton : aucun ticket ni table de connexion'
);

-- Send Email Hook : refuse tout ---------------------------------------------- (5)
select has_function('auth_hooks', 'send_email', array['jsonb'], 'fonction auth_hooks.send_email(jsonb)');
select is(
  array(
    select distinct auth_hooks.send_email(pg_temp.mail_evt(t.type, 'organisateur.inscrit@example.com'))::text
    from unnest(array['signup', 'invite', 'magiclink', 'recovery', 'email_change', 'email',
                      'reauthentication', 'password_changed_notification',
                      'email_changed_notification', 'phone_changed_notification',
                      'identity_linked_notification', 'identity_unlinked_notification',
                      'mfa_factor_enrolled_notification', 'mfa_factor_unenrolled_notification',
                      'type_futur_inconnu']) as t(type)
  ),
  array['{"error": {"message": "email_sending_disabled", "http_code": 403}}'],
  'tous les types d''e-mail (y compris futurs) : même refus, rien n''est envoyé'
);
select is(
  auth_hooks.send_email(pg_temp.mail_evt('magiclink', 'admin.actif@example.com')),
  auth_hooks.send_email(pg_temp.mail_evt('magiclink', 'adresse.inconnue@example.com')),
  'refus identique pour un admin, un organisateur ou une adresse inconnue (D23)'
);
select is(auth_hooks.send_email(null), '{"error": {"http_code": 403, "message": "email_sending_disabled"}}'::jsonb,
  'événement nul : même refus');
select is(auth_hooks.send_email('"pas un objet"'::jsonb),
  '{"error": {"http_code": 403, "message": "email_sending_disabled"}}'::jsonb,
  'événement mal formé : même refus');

-- Structure et droits ------------------------------------------------------- (13)
select has_function('auth_hooks', 'custom_access_token', array['jsonb'],
  'fonction auth_hooks.custom_access_token(jsonb)');
select ok(to_regprocedure('public.custom_access_token(jsonb)') is null
          and to_regprocedure('public.custom_access_token_hook(jsonb)') is null
          and to_regprocedure('public.send_email(jsonb)') is null,
  'aucun hook dans le schéma public (exposé par l''API)');
select is(
  array(
    select p.oid::regprocedure::text
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'auth_hooks'
    order by 1
  ),
  array['auth_hooks.custom_access_token(jsonb)', 'auth_hooks.send_email(jsonb)'],
  'le schéma auth_hooks ne contient que les deux hooks'
);
select ok(
  (select p.prosecdef and 'search_path=""' = any(coalesce(p.proconfig, array[]::text[]))
   from pg_catalog.pg_proc p where p.oid = 'auth_hooks.custom_access_token(jsonb)'::regprocedure),
  'hook de jeton : SECURITY DEFINER (lecture de admin_users) avec search_path vide'
);
select ok(
  (select not p.prosecdef and 'search_path=""' = any(coalesce(p.proconfig, array[]::text[]))
   from pg_catalog.pg_proc p where p.oid = 'auth_hooks.send_email(jsonb)'::regprocedure),
  'hook d''e-mail : SECURITY INVOKER (aucun droit nécessaire) avec search_path vide'
);
select ok(has_function_privilege('supabase_auth_admin', 'auth_hooks.custom_access_token(jsonb)', 'EXECUTE')
          and has_function_privilege('supabase_auth_admin', 'auth_hooks.send_email(jsonb)', 'EXECUTE'),
  'supabase_auth_admin : EXECUTE sur les deux hooks');
select is(
  array(
    select format('%s:%s', r.rolname, f.sig)
    from (values ('anon'), ('authenticated'), ('service_role')) as r(rolname)
    cross join (values ('auth_hooks.custom_access_token(jsonb)'), ('auth_hooks.send_email(jsonb)')) as f(sig)
    where has_function_privilege(r.rolname::name, f.sig::regprocedure, 'EXECUTE')
    order by 1
  ),
  array[]::text[],
  'anon, authenticated, service_role : aucun EXECUTE sur les hooks'
);
select is(
  array(
    select r.rolname::text
    from (values ('anon'), ('authenticated'), ('service_role')) as r(rolname)
    where has_schema_privilege(r.rolname::name, 'auth_hooks', 'USAGE')
    order by 1
  ),
  array[]::text[],
  'anon, authenticated, service_role : aucun USAGE sur auth_hooks'
);
select is(
  array(
    select p.oid::regprocedure::text
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'auth_hooks'
      and (p.proacl is null
           or exists (select 1 from pg_catalog.aclexplode(p.proacl) as a where a.grantee = 0))
    order by 1
  ),
  array[]::text[],
  'hooks : ACL explicite sans entrée PUBLIC'
);
select ok(has_schema_privilege('supabase_auth_admin', 'auth_hooks', 'USAGE'),
  'supabase_auth_admin : USAGE sur auth_hooks');
select ok(not has_schema_privilege('supabase_auth_admin', 'private', 'USAGE'),
  'supabase_auth_admin : toujours aucun USAGE sur private');
select is(
  array(
    select c.relname::text
    from pg_catalog.pg_class c
    where c.oid in ('public.login_attempts'::regclass, 'public.login_ip_attempts'::regclass,
                    'public.login_code_global_counter'::regclass)
      and (has_table_privilege('supabase_auth_admin', c.oid, 'SELECT')
           or has_table_privilege('supabase_auth_admin', c.oid, 'INSERT')
           or has_table_privilege('supabase_auth_admin', c.oid, 'UPDATE')
           or has_table_privilege('supabase_auth_admin', c.oid, 'DELETE'))
    order by 1
  ),
  array[]::text[],
  'supabase_auth_admin : aucun droit sur les tables de connexion'
);
select is(
  array(
    select p.oid::regprocedure::text
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'auth_hooks'
      and obj_description(p.oid, 'pg_proc') is null
    order by 1
  ),
  array[]::text[],
  'hooks : commentaire présent'
);

select * from finish();
rollback;
