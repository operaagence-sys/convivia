-- Tranche 1 — socle : privilèges par défaut durcis (migration
-- 20261021140600_revoke_default_privileges_public ; décision du porteur du
-- projet du 2026-10-21 ; docs/07 § 1.1, refus par défaut).
-- Les objets « sonde » créés ici disparaissent avec le rollback final.
begin;
create extension if not exists pgtap with schema extensions;

select plan(17);

-- pg_default_acl : rôle postgres, schéma public -------------------------- (5)
select is_empty(
  $$select a.grantee::regrole::text
    from pg_catalog.pg_default_acl d
    cross join lateral pg_catalog.aclexplode(d.defaclacl) as a
    where d.defaclrole = 'postgres'::regrole
      and d.defaclnamespace = 'public'::regnamespace
      and d.defaclobjtype = 'r'
      and a.grantee in ('anon'::regrole, 'authenticated'::regrole)$$,
  'postgres / public : aucun privilège par défaut sur les tables pour anon ni authenticated'
);
select is_empty(
  $$select a.grantee::regrole::text
    from pg_catalog.pg_default_acl d
    cross join lateral pg_catalog.aclexplode(d.defaclacl) as a
    where d.defaclrole = 'postgres'::regrole
      and d.defaclnamespace = 'public'::regnamespace
      and d.defaclobjtype = 'S'
      and a.grantee in ('anon'::regrole, 'authenticated'::regrole)$$,
  'postgres / public : aucun privilège par défaut sur les séquences pour anon ni authenticated'
);
select is_empty(
  $$select a.grantee::regrole::text
    from pg_catalog.pg_default_acl d
    cross join lateral pg_catalog.aclexplode(d.defaclacl) as a
    where d.defaclrole = 'postgres'::regrole
      and d.defaclnamespace = 'public'::regnamespace
      and d.defaclobjtype = 'f'
      and a.grantee in ('anon'::regrole, 'authenticated'::regrole)$$,
  'postgres / public : aucun privilège par défaut sur les fonctions pour anon ni authenticated'
);
select ok(
  exists (
    select 1
    from pg_catalog.pg_default_acl d
    where d.defaclrole = 'postgres'::regrole
      and d.defaclnamespace = 0
      and d.defaclobjtype = 'f'
      and not exists (
        select 1 from pg_catalog.aclexplode(d.defaclacl) as a where a.grantee = 0
      )
  ),
  'postgres (tous schémas) : plus d''EXECUTE par défaut pour PUBLIC sur les fonctions'
);
select is(
  (
    select count(distinct d.defaclobjtype)
    from pg_catalog.pg_default_acl d
    cross join lateral pg_catalog.aclexplode(d.defaclacl) as a
    where d.defaclrole = 'postgres'::regrole
      and d.defaclnamespace = 'public'::regnamespace
      and d.defaclobjtype in ('r', 'S', 'f')
      and a.grantee = 'service_role'::regrole
  ),
  3::bigint,
  'postgres / public : service_role garde ses privilèges par défaut (tables, séquences, fonctions)'
);

-- Effet réel sur des objets créés maintenant par postgres ----------------- (11)
set local role postgres;
create table public.zz_default_acl_probe (id integer);
create sequence public.zz_default_acl_probe_seq;
create function public.zz_default_acl_probe_fn() returns integer
  language sql set search_path = '' as $$ select 1 $$;
create function private.zz_default_acl_probe_fn() returns integer
  language sql set search_path = '' as $$ select 1 $$;
reset role;

select ok(
  not has_table_privilege('anon', 'public.zz_default_acl_probe',
    'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN'),
  'nouvelle table : aucun droit pour anon'
);
select ok(
  not has_table_privilege('authenticated', 'public.zz_default_acl_probe',
    'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN'),
  'nouvelle table : aucun droit pour authenticated'
);
select ok(
  has_table_privilege('service_role', 'public.zz_default_acl_probe', 'SELECT')
    and has_table_privilege('service_role', 'public.zz_default_acl_probe', 'INSERT')
    and has_table_privilege('service_role', 'public.zz_default_acl_probe', 'UPDATE')
    and has_table_privilege('service_role', 'public.zz_default_acl_probe', 'DELETE'),
  'nouvelle table : service_role garde SELECT / INSERT / UPDATE / DELETE'
);
select ok(
  not has_sequence_privilege('anon', 'public.zz_default_acl_probe_seq', 'USAGE, SELECT, UPDATE'),
  'nouvelle séquence : aucun droit pour anon'
);
select ok(
  not has_sequence_privilege('authenticated', 'public.zz_default_acl_probe_seq', 'USAGE, SELECT, UPDATE'),
  'nouvelle séquence : aucun droit pour authenticated'
);
select ok(
  has_sequence_privilege('service_role', 'public.zz_default_acl_probe_seq', 'USAGE'),
  'nouvelle séquence : service_role garde USAGE'
);
select ok(
  not has_function_privilege('anon', 'public.zz_default_acl_probe_fn()', 'EXECUTE'),
  'nouvelle fonction de public : anon ne peut pas l''exécuter (ni directement ni via PUBLIC)'
);
select ok(
  not has_function_privilege('authenticated', 'public.zz_default_acl_probe_fn()', 'EXECUTE'),
  'nouvelle fonction de public : authenticated ne peut pas l''exécuter'
);
select ok(
  has_function_privilege('service_role', 'public.zz_default_acl_probe_fn()', 'EXECUTE'),
  'nouvelle fonction de public : service_role peut l''exécuter'
);
select ok(
  not has_function_privilege('anon', 'private.zz_default_acl_probe_fn()', 'EXECUTE')
    and not has_function_privilege('authenticated', 'private.zz_default_acl_probe_fn()', 'EXECUTE'),
  'nouvelle fonction de private : ni anon ni authenticated (plus d''EXECUTE pour PUBLIC)'
);
select ok(
  (select p.proacl is not null
     and not exists (select 1 from pg_catalog.aclexplode(p.proacl) as a where a.grantee = 0)
   from pg_catalog.pg_proc p
   where p.oid = 'public.zz_default_acl_probe_fn()'::regprocedure),
  'nouvelle fonction : ACL explicite, sans entrée PUBLIC'
);

-- Les droits voulus déjà accordés restent en place ------------------------ (1)
select ok(
  has_table_privilege('anon', 'public.countries', 'SELECT')
    and has_table_privilege('authenticated', 'public.countries', 'SELECT')
    and has_table_privilege('anon', 'public.pricing_tiers', 'SELECT')
    and has_table_privilege('authenticated', 'public.pricing_tiers', 'SELECT'),
  'SELECT explicite d''anon et authenticated sur countries et pricing_tiers conservé'
);

select * from finish();
rollback;
