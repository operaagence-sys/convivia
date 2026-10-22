-- Tranche 2 — connexion : structure, RLS, politiques exactes et droits exacts
-- de organizers, admin_users, des tables de connexion (login_attempts,
-- login_ip_attempts, login_code_global_counter) et des 4 fonctions serveur ;
-- retrait de l'ancien parcours (tickets, before_* / reset / status) ;
-- présence des commentaires sur tout le schéma (écart E4 de la revue
-- conventions de la tranche 1).
-- Sources : docs/07 § 1.2 (règles 1, 6, 8), § 2.1, § 2.2, § 13, § 17 ;
-- docs/09 § 20 quater ; migrations 20261021150000 à 20261021150400,
-- 20261022120000 et 20261022120100.
begin;
create extension if not exists pgtap with schema extensions;

select plan(69);

-- Tables -------------------------------------------------------------------- (7)
select has_table('public', 'organizers', 'table organizers');
select has_table('public', 'admin_users', 'table admin_users');
select has_table('public', 'login_attempts', 'table login_attempts');
select has_table('public', 'login_ip_attempts', 'table login_ip_attempts');
select has_table('public', 'login_code_global_counter', 'table login_code_global_counter');
select hasnt_table('public', 'login_send_tickets', 'ancien ticket d''envoi supprimé');
select hasnt_table('public', 'login_verify_tickets', 'ancien ticket de vérification supprimé');

-- Colonnes exactes (colonnes reportées : acquisition_link_id et
-- posthog_distinct_id en tranche 13, phone_* en tranche 5) --------------- (5)
select columns_are('public', 'organizers',
  array['id', 'full_name', 'email', 'country_code', 'city', 'status', 'suspended_at',
        'suspended_by', 'suspension_reason', 'created_at', 'updated_at'],
  'organizers : colonnes de la tranche 2');
select columns_are('public', 'admin_users',
  array['user_id', 'full_name', 'email', 'is_active', 'created_by', 'last_login_at',
        'failed_logins', 'locked_until', 'created_at', 'updated_at'],
  'admin_users : colonnes de 07 § 2.2 (+ updated_at)');
select columns_are('public', 'login_attempts',
  array['identifier_hash', 'failed_count', 'locked_until', 'send_times', 'code_hmac',
        'code_expires_at', 'created_at', 'updated_at'],
  'login_attempts : colonnes de 07 § 2.1 (+ send_times, + empreinte du code actif) ; aucun e-mail ni code en clair');
select columns_are('public', 'login_ip_attempts',
  array['ip_hash', 'ip_scope', 'action', 'attempt_times', 'created_at', 'updated_at'],
  'login_ip_attempts : empreinte, portée (/64 ou /48), action, dates ; aucune IP en clair');
select columns_are('public', 'login_code_global_counter',
  array['id', 'issue_times', 'cap_alerted_at', 'created_at', 'updated_at'],
  'login_code_global_counter : aucune donnée personnelle');

-- RLS ----------------------------------------------------------------------- (1)
select is(
  array(
    select c.relname::text
    from pg_catalog.pg_class c
    where c.oid in ('public.organizers'::regclass, 'public.admin_users'::regclass,
                    'public.login_attempts'::regclass, 'public.login_ip_attempts'::regclass,
                    'public.login_code_global_counter'::regclass)
      and not c.relrowsecurity
    order by 1
  ),
  array[]::text[],
  'RLS activée sur organizers, admin_users et les 3 tables de connexion'
);

-- Politiques exactes -------------------------------------------------------- (6)
select policies_are('public', 'organizers',
  array['organizers_select_own', 'organizers_update_own_active'],
  'organizers : lecture de sa ligne et modification si actif, rien d''autre');
select is(
  array(
    select format('%s.%s', c.relname, pol.polname)
    from pg_catalog.pg_policy pol
    join pg_catalog.pg_class c on c.oid = pol.polrelid
    where c.oid in ('public.admin_users'::regclass, 'public.login_attempts'::regclass,
                    'public.login_ip_attempts'::regclass, 'public.login_code_global_counter'::regclass)
    order by 1
  ),
  array[]::text[],
  'admin_users et tables de connexion : aucune politique (serveur seul, par fonctions)'
);
select policy_roles_are('public', 'organizers', 'organizers_select_own', array['authenticated'],
  'organizers_select_own : authenticated seulement');
select policy_cmd_is('public', 'organizers', 'organizers_select_own', 'SELECT',
  'organizers_select_own : SELECT');
select policy_roles_are('public', 'organizers', 'organizers_update_own_active', array['authenticated'],
  'organizers_update_own_active : authenticated seulement');
select policy_cmd_is('public', 'organizers', 'organizers_update_own_active', 'UPDATE',
  'organizers_update_own_active : UPDATE');

-- Droits de table : anon ----------------------------------------------------- (1)
select is(
  array(
    select format('%s:%s', c.relname, p.priv)
    from pg_catalog.pg_class c
    cross join unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN']) as p(priv)
    where c.oid in ('public.organizers'::regclass, 'public.admin_users'::regclass,
                    'public.login_attempts'::regclass, 'public.login_ip_attempts'::regclass,
                    'public.login_code_global_counter'::regclass)
      and case
            when p.priv in ('SELECT', 'INSERT', 'UPDATE', 'REFERENCES')
              then has_any_column_privilege('anon', c.oid, p.priv)
            else has_table_privilege('anon', c.oid, p.priv)
          end
    order by 1
  ),
  array[]::text[],
  'anon : aucun droit (table ni colonne) sur organizers, admin_users et les tables de connexion'
);

-- Droits de table : authenticated ------------------------------------------- (4)
select is(
  array(
    select format('%s:%s', c.relname, p.priv)
    from pg_catalog.pg_class c
    cross join unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN']) as p(priv)
    where c.oid in ('public.organizers'::regclass, 'public.admin_users'::regclass,
                    'public.login_attempts'::regclass, 'public.login_ip_attempts'::regclass,
                    'public.login_code_global_counter'::regclass)
      and case
            when p.priv in ('SELECT', 'INSERT', 'UPDATE', 'REFERENCES')
              then has_any_column_privilege('authenticated', c.oid, p.priv)
            else has_table_privilege('authenticated', c.oid, p.priv)
          end
    order by 1
  ),
  array['organizers:SELECT', 'organizers:UPDATE'],
  'authenticated : seulement SELECT et UPDATE (par colonnes) sur organizers ; rien sur admin_users ni sur les tables de connexion'
);
select ok(
  not has_table_privilege('authenticated', 'public.organizers', 'SELECT'),
  'authenticated : pas de SELECT sur toute la table organizers (colonnes accordées une à une)'
);
select is(
  array(
    select a.attname::text
    from pg_catalog.pg_attribute a
    where a.attrelid = 'public.organizers'::regclass
      and a.attnum > 0 and not a.attisdropped
      and has_column_privilege('authenticated', a.attrelid, a.attnum, 'SELECT')
    order by 1
  ),
  array['city', 'country_code', 'created_at', 'email', 'full_name', 'id', 'status', 'suspended_at', 'updated_at'],
  'authenticated : colonnes lisibles de organizers (ni suspended_by ni suspension_reason)'
);
select is(
  array(
    select a.attname::text
    from pg_catalog.pg_attribute a
    where a.attrelid = 'public.organizers'::regclass
      and a.attnum > 0 and not a.attisdropped
      and has_column_privilege('authenticated', a.attrelid, a.attnum, 'UPDATE')
    order by 1
  ),
  array['city', 'country_code', 'full_name'],
  'authenticated : seules full_name, city, country_code sont modifiables (07 § 2.1)'
);

-- Droits de table : service_role -------------------------------------------- (1)
select is(
  array(
    select format('%s:%s', c.relname, p.priv)
    from pg_catalog.pg_class c
    cross join unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN']) as p(priv)
    where c.oid in ('public.organizers'::regclass, 'public.admin_users'::regclass,
                    'public.login_attempts'::regclass, 'public.login_ip_attempts'::regclass,
                    'public.login_code_global_counter'::regclass)
      and case
            when p.priv in ('SELECT', 'INSERT', 'UPDATE', 'REFERENCES')
              then has_any_column_privilege('service_role', c.oid, p.priv)
            else has_table_privilege('service_role', c.oid, p.priv)
          end
    order by 1
  ),
  array['admin_users:SELECT', 'organizers:SELECT'],
  'service_role : SELECT sur organizers et admin_users seulement ; rien sur les tables de connexion (fonctions)'
);

-- Clés étrangères ------------------------------------------------------------ (5)
select is(
  (select con.confdeltype::text from pg_catalog.pg_constraint con
   where con.conrelid = 'public.organizers'::regclass and con.contype = 'f'
     and con.confrelid = 'auth.users'::regclass),
  'c',
  'organizers.id → auth.users ON DELETE CASCADE (07 § 2.1)'
);
select fk_ok('public', 'organizers', 'country_code', 'public', 'countries', 'code',
  'organizers.country_code → countries.code');
select fk_ok('public', 'organizers', 'suspended_by', 'public', 'admin_users', 'user_id',
  'organizers.suspended_by → admin_users.user_id');
select is(
  (select con.confdeltype::text from pg_catalog.pg_constraint con
   where con.conrelid = 'public.admin_users'::regclass and con.contype = 'f'
     and con.confrelid = 'auth.users'::regclass),
  'a',
  'admin_users.user_id → auth.users, NO ACTION (un compte admin ne se supprime pas en silence)'
);
select fk_ok('public', 'admin_users', 'created_by', 'public', 'admin_users', 'user_id',
  'admin_users.created_by → admin_users.user_id');

-- Déclencheurs --------------------------------------------------------------- (8)
select has_trigger('public', 'organizers', 'organizers_set_updated_at', 'organizers : updated_at');
select has_trigger('public', 'organizers', 'organizers_check_country_active', 'organizers : pays actif (D53)');
select has_trigger('public', 'organizers', 'organizers_reject_admin_account', 'organizers : exclusivité admin');
select has_trigger('public', 'admin_users', 'admin_users_reject_organizer_account', 'admin_users : exclusivité organisateur');
select has_trigger('public', 'admin_users', 'admin_users_set_updated_at', 'admin_users : updated_at');
select has_trigger('public', 'login_attempts', 'login_attempts_set_updated_at', 'login_attempts : updated_at');
select has_trigger('public', 'login_ip_attempts', 'login_ip_attempts_set_updated_at', 'login_ip_attempts : updated_at');
select has_trigger('public', 'login_code_global_counter', 'login_code_global_counter_set_updated_at',
  'login_code_global_counter : updated_at');

-- Plafond global : une seule ligne ------------------------------------------ (2)
select is((select count(*)::integer from public.login_code_global_counter), 1,
  'login_code_global_counter : exactement une ligne');
select throws_ok(
  $$insert into public.login_code_global_counter (id) values (false)$$,
  '23514', null, 'login_code_global_counter : une seconde ligne est refusée');

-- Fonctions serveur (public) ------------------------------------------------ (4)
select has_function('public', 'auth_email_is_admin', array['text'], 'fonction auth_email_is_admin(text)');
select has_function('public', 'ensure_organizer', array['uuid'], 'fonction ensure_organizer(uuid)');
select has_function('public', 'login_code_issue', array['text', 'text', 'text', 'text', 'text'],
  'fonction login_code_issue(identifiant, IP /64, IP /48, empreinte du code, e-mail)');
select has_function('public', 'login_code_verify', array['text', 'text', 'text', 'text', 'text'],
  'fonction login_code_verify(identifiant, IP /64, IP /48, empreinte du code, e-mail)');

-- Ancien parcours retiré (migration 20261022120100) : une ligne par signature,
-- pour qu'un échec nomme la fonction restée en place. Les tables des tickets
-- (login_send_tickets, login_verify_tickets) sont couvertes plus haut par
-- hasnt_table. ------------------------------------------------------------- (15)
select hasnt_function('public', 'login_attempt_before_send', array['text'],
  'ancien parcours : login_attempt_before_send(text) supprimée');
select hasnt_function('public', 'login_attempt_before_send', array['text', 'text'],
  'ancien parcours : login_attempt_before_send(text, text) supprimée');
select hasnt_function('public', 'login_attempt_before_verify', array['text'],
  'ancien parcours : login_attempt_before_verify(text) supprimée');
select hasnt_function('public', 'login_attempt_before_verify', array['text', 'text'],
  'ancien parcours : login_attempt_before_verify(text, text) supprimée');
select hasnt_function('public', 'login_attempt_reset', array['text'],
  'ancien parcours : login_attempt_reset(text) supprimée');
select hasnt_function('public', 'login_attempt_reset', array['text', 'text'],
  'ancien parcours : login_attempt_reset(text, text) absente');
select hasnt_function('public', 'login_attempt_status', array['text'],
  'ancien parcours : login_attempt_status(text) supprimée');
select hasnt_function('public', 'login_attempt_status', array['text', 'text'],
  'ancien parcours : login_attempt_status(text, text) absente');
select hasnt_function('public', 'login_send_ticket_consume', array['text', 'text'],
  'ancien parcours : login_send_ticket_consume(text, text) absente');
select hasnt_function('public', 'login_verify_ticket_issue', array['text', 'text'],
  'ancien parcours : login_verify_ticket_issue(text, text) absente');
select hasnt_function('public', 'login_verify_ticket_revoke', array['uuid'],
  'ancien parcours : login_verify_ticket_revoke(uuid) absente');
select hasnt_function('private', 'login_ip_attempt_check', array['text', 'text'],
  'ancien parcours : private.login_ip_attempt_check(text, text) absente');
select hasnt_function('private', 'login_ip_limits', array['text'],
  'ancien parcours : private.login_ip_limits(text) absente (remplacée par login_ip_limits(text, text))');
select hasnt_function('private', 'login_send_ticket_ttl', array[]::text[],
  'ancien parcours : private.login_send_ticket_ttl() absente');
select hasnt_function('private', 'login_verify_ticket_ttl', array[]::text[],
  'ancien parcours : private.login_verify_ticket_ttl() absente');

-- Fonctions serveur : SECURITY DEFINER, search_path vide, EXECUTE ----------- (5)
select is(
  array(
    select f.sig
    from (values ('public.auth_email_is_admin(text)'), ('public.ensure_organizer(uuid)'),
                 ('public.login_code_issue(text,text,text,text,text)'),
                 ('public.login_code_verify(text,text,text,text,text)')) as f(sig)
    left join pg_catalog.pg_proc p on p.oid = to_regprocedure(f.sig)
    where p.oid is null
       or not p.prosecdef
       or not ('search_path=""' = any(coalesce(p.proconfig, array[]::text[])))
    order by 1
  ),
  array[]::text[],
  'les 4 fonctions serveur sont SECURITY DEFINER avec search_path vide'
);
select is(
  array(
    select p.oid::regprocedure::text
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and has_function_privilege('anon', p.oid, 'EXECUTE')
    order by 1
  ),
  array[]::text[],
  'anon : aucune fonction du schéma public exécutable (présentes et futures)'
);
select is(
  array(
    select f.sig
    from (values ('public.auth_email_is_admin(text)'), ('public.ensure_organizer(uuid)'),
                 ('public.login_code_issue(text,text,text,text,text)'),
                 ('public.login_code_verify(text,text,text,text,text)')) as f(sig)
    where to_regprocedure(f.sig) is null
       or has_function_privilege('authenticated', to_regprocedure(f.sig), 'EXECUTE')
    order by 1
  ),
  array[]::text[],
  'authenticated : aucune des 4 fonctions serveur n''est exécutable'
);
select is(
  array(
    select f.sig
    from (values ('public.auth_email_is_admin(text)'), ('public.ensure_organizer(uuid)'),
                 ('public.login_code_issue(text,text,text,text,text)'),
                 ('public.login_code_verify(text,text,text,text,text)')) as f(sig)
    where to_regprocedure(f.sig) is null
       or not has_function_privilege('service_role', to_regprocedure(f.sig), 'EXECUTE')
    order by 1
  ),
  array[]::text[],
  'service_role : les 4 fonctions serveur sont exécutables'
);
select is(
  array(
    select p.oid::regprocedure::text
    from pg_catalog.pg_proc p
    where p.oid in (
      select to_regprocedure(f.sig)
      from (values ('public.auth_email_is_admin(text)'), ('public.ensure_organizer(uuid)'),
                   ('public.login_code_issue(text,text,text,text,text)'),
                   ('public.login_code_verify(text,text,text,text,text)')) as f(sig)
    )
      and (p.proacl is null
           or exists (select 1 from pg_catalog.aclexplode(p.proacl) as a where a.grantee = 0))
    order by 1
  ),
  array[]::text[],
  'les 4 fonctions serveur ont une ACL explicite sans entrée PUBLIC'
);

-- Fonctions internes (private) ---------------------------------------------- (2)
select is(
  array(
    select f.sig
    from (values ('private.login_attempt_lock_row(text)'), ('private.purge_login_attempts()'),
                 ('private.login_code_settings()'), ('private.login_ip_limits(text,text)'),
                 ('private.login_ip_window(text,text,text)'), ('private.login_ip_gate(text,text,text)'),
                 ('private.login_code_global_window()'), ('private.login_code_check_args(text,text,text)'),
                 ('private.organizers_check_country_active()'), ('private.organizers_reject_admin_account()'),
                 ('private.admin_users_reject_organizer_account()')) as f(sig)
    where to_regprocedure(f.sig) is null
       or has_function_privilege('service_role', to_regprocedure(f.sig), 'EXECUTE')
       or has_function_privilege('authenticated', to_regprocedure(f.sig), 'EXECUTE')
       or has_function_privilege('anon', to_regprocedure(f.sig), 'EXECUTE')
    order by 1
  ),
  array[]::text[],
  'fonctions internes (private) de la tranche 2 : existent et ne sont exécutables par aucun rôle de l''API'
);
select is(
  array(
    select f.sig
    from (values ('private.login_attempt_lock_row(text)'), ('private.purge_login_attempts()'),
                 ('private.login_code_settings()'), ('private.login_ip_limits(text,text)'),
                 ('private.login_ip_window(text,text,text)'), ('private.login_ip_gate(text,text,text)'),
                 ('private.login_code_global_window()'), ('private.login_code_check_args(text,text,text)')) as f(sig)
    left join pg_catalog.pg_proc p on p.oid = to_regprocedure(f.sig)
    where p.oid is null
       or not ('search_path=""' = any(coalesce(p.proconfig, array[]::text[])))
    order by 1
  ),
  array[]::text[],
  'fonctions internes de la connexion : search_path vide'
);

-- Commentaires sur tout le schéma (09 § 20 quater, écart E4) ---------------- (3)
select is(
  array(
    select c.relname::text
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p', 'v', 'm')
      and obj_description(c.oid, 'pg_class') is null
    order by 1
  ),
  array[]::text[],
  'chaque table et vue du schéma public porte un commentaire'
);
select is(
  array(
    select p.oid::regprocedure::text
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private', 'auth_hooks')
      and obj_description(p.oid, 'pg_proc') is null
    order by 1
  ),
  array[]::text[],
  'chaque fonction des schémas public, private et auth_hooks porte un commentaire'
);
select is(
  array(
    select format('%s.%s', c.relname, pol.polname)
    from pg_catalog.pg_policy pol
    join pg_catalog.pg_class c on c.oid = pol.polrelid
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and obj_description(pol.oid, 'pg_policy') is null
    order by 1
  ),
  array[]::text[],
  'chaque politique RLS du schéma public porte un commentaire'
);

select * from finish();
rollback;
