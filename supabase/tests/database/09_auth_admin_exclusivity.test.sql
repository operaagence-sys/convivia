-- Tranche 2 — connexion : exclusivité organisateur / admin dans les deux
-- sens, refus des comptes admin par ensure_organizer (sans événement
-- organizer.signed_up), détection des adresses admin (auth_email_is_admin)
-- et fermeture de admin_users.
-- Sources : docs/07 § 2.2 (« un déclencheur refuse la création d'une ligne
-- organizers pour un user_id présent ici, et inversement »), § 11.1, § 13, § 17
-- (« /login avec l'e-mail d'un admin → aucun code envoyé ») ; docs/06 § 7.1,
-- § 8.1, D13, D23, D50.
-- Données fictives (domaine réservé example.com) ; tout est annulé.
begin;
create extension if not exists pgtap with schema extensions;

select plan(34);

-- Données de test ---------------------------------------------------------------
insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-4000-8000-00000000a001', 'admin.fictif@example.com', now()),
  ('00000000-0000-4000-8000-00000000a002', 'admin.inactif@example.com', now()),
  ('00000000-0000-4000-8000-00000000a003', 'nouvelle.adresse@example.com', now()),
  ('00000000-0000-4000-8000-00000000a004', 'autre.admin@example.com', now()),
  ('00000000-0000-4000-8000-00000000b001', 'organisateur.fictif@example.com', now());

insert into public.admin_users (user_id, full_name, email, is_active) values
  ('00000000-0000-4000-8000-00000000a001', 'Admin Fictif', 'admin.fictif@example.com', true),
  ('00000000-0000-4000-8000-00000000a002', 'Admin Inactif', 'admin.inactif@example.com', false),
  -- adresse admin différente de l'adresse auth.users (les deux sont refusées)
  ('00000000-0000-4000-8000-00000000a003', 'Admin Trois', 'ancienne.adresse@example.com', true);

-- Serveur : création des organisateurs ------------------------------------- (4)
set local role service_role;

select results_eq(
  $$select created, profile_complete, organizer_status::text
    from public.ensure_organizer('00000000-0000-4000-8000-00000000b001')$$,
  $$values (true, false, 'active')$$,
  'ensure_organizer : compte non admin accepté'
);
select throws_ok(
  $$select * from public.ensure_organizer('00000000-0000-4000-8000-00000000a001')$$,
  'P0001', 'admin_account', 'ensure_organizer : compte admin refusé');
select throws_ok(
  $$select * from public.ensure_organizer('00000000-0000-4000-8000-00000000a002')$$,
  'P0001', 'admin_account', 'ensure_organizer : compte admin désactivé refusé aussi');

reset role;

select is_empty(
  $$select id from public.organizers
    where id in ('00000000-0000-4000-8000-00000000a001', '00000000-0000-4000-8000-00000000a002')$$,
  'aucune ligne organizers pour un compte admin'
);

-- Inscription mesurée (07 § 11.1) ------------------------------------------ (2)
select is_empty(
  $$select id from public.analytics_events
    where organizer_ref in ('00000000-0000-4000-8000-00000000a001', '00000000-0000-4000-8000-00000000a002')$$,
  'compte admin refusé : aucun événement organizer.signed_up écrit'
);
select results_eq(
  $$select count(*)::int from public.analytics_events
    where name = 'organizer.signed_up'
      and organizer_ref = '00000000-0000-4000-8000-00000000b001'$$,
  $$values (1)$$,
  'compte non admin accepté : un événement organizer.signed_up'
);

-- Déclencheurs d'exclusivité (même pour postgres) --------------------------- (4)
select throws_ok(
  $$insert into public.organizers (id, email)
    values ('00000000-0000-4000-8000-00000000a001', 'admin.fictif@example.com')$$,
  'P0001', null, 'organizers : INSERT d''un compte admin refusé par déclencheur');
select throws_ok(
  $$insert into public.admin_users (user_id, full_name, email)
    values ('00000000-0000-4000-8000-00000000b001', 'Organisateur Promu', 'organisateur.fictif@example.com')$$,
  'P0001', null, 'admin_users : INSERT d''un compte organisateur refusé par déclencheur (sens inverse)');
select throws_ok(
  $$update public.admin_users set user_id = '00000000-0000-4000-8000-00000000b001'
    where user_id = '00000000-0000-4000-8000-00000000a003'$$,
  'P0001', null, 'admin_users : changer user_id vers un organisateur refusé');
select throws_ok(
  $$update public.organizers set id = '00000000-0000-4000-8000-00000000a001'
    where id = '00000000-0000-4000-8000-00000000b001'$$,
  'P0001', null, 'organizers : changer id vers un admin refusé');

-- auth_email_is_admin (service_role) ----------------------------------------- (9)
set local role service_role;

select is(public.auth_email_is_admin('admin.fictif@example.com'), true,
  'auth_email_is_admin : adresse admin reconnue');
select is(public.auth_email_is_admin('  ADMIN.Fictif@Example.COM '), true,
  'auth_email_is_admin : insensible à la casse et aux espaces de bord');
select is(public.auth_email_is_admin('admin.inactif@example.com'), true,
  'auth_email_is_admin : admin désactivé toujours reconnu');
select is(public.auth_email_is_admin('ancienne.adresse@example.com'), true,
  'auth_email_is_admin : adresse de admin_users reconnue');
select is(public.auth_email_is_admin('nouvelle.adresse@example.com'), true,
  'auth_email_is_admin : adresse auth.users d''un admin reconnue');
select is(public.auth_email_is_admin('organisateur.fictif@example.com'), false,
  'auth_email_is_admin : adresse d''organisateur → faux');
select is(public.auth_email_is_admin('inconnu@example.com'), false,
  'auth_email_is_admin : adresse sans compte → faux');
select throws_ok($$select public.auth_email_is_admin(null)$$, '22004', null,
  'auth_email_is_admin : adresse nulle refusée');
select throws_ok($$select public.auth_email_is_admin('   ')$$, '22004', null,
  'auth_email_is_admin : adresse vide refusée');

-- admin_users côté serveur : lecture seule ------------------------------------ (4)
select results_eq(
  'select count(*)::integer from public.admin_users',
  $$values (3)$$,
  'service_role : lit admin_users'
);
select throws_ok(
  $$insert into public.admin_users (user_id, full_name, email)
    values ('00000000-0000-4000-8000-00000000a004', 'Autre Admin', 'autre.admin@example.com')$$,
  '42501', null, 'service_role : INSERT direct refusé (create_admin en tranche 8)');
select throws_ok(
  $$update public.admin_users set is_active = true$$,
  '42501', null, 'service_role : UPDATE direct refusé');
select throws_ok(
  $$delete from public.admin_users$$,
  '42501', null, 'service_role : DELETE refusé');

reset role;

-- Admin connecté (même aal2) : rien en tranche 2 ----------------------------- (3)
set local role authenticated;
set local "request.jwt.claims" to
  '{"sub":"00000000-0000-4000-8000-00000000a001","role":"authenticated","aal":"aal2"}';

select throws_ok('select user_id from public.admin_users', '42501', null,
  'admin aal2 : admin_users illisible en tranche 2 (politiques en tranche 8)');
select throws_ok($$select public.auth_email_is_admin('admin.fictif@example.com')$$, '42501', null,
  'authenticated : auth_email_is_admin non exécutable (ne sonde pas qui est admin)');
select is_empty('select id from public.organizers',
  'admin connecté : aucune ligne organizers visible');

reset role;

-- Visiteur (anon) ----------------------------------------------------------- (2)
set local role anon;
set local "request.jwt.claims" to '{"role":"anon"}';

select throws_ok($$select public.auth_email_is_admin('admin.fictif@example.com')$$, '42501', null,
  'anon : auth_email_is_admin non exécutable');
select throws_ok('select user_id from public.admin_users', '42501', null,
  'anon : admin_users illisible');

reset role;

-- Contraintes de admin_users ------------------------------------------------- (6)
select throws_ok(
  $$insert into public.admin_users (user_id, full_name, email)
    values ('00000000-0000-4000-8000-00000000a004', 'Autre Admin', 'Autre.Admin@example.com')$$,
  '23514', null, 'admin_users : e-mail en majuscules refusé (stocké en minuscules)');
select throws_ok(
  $$insert into public.admin_users (user_id, full_name, email)
    values ('00000000-0000-4000-8000-00000000a004', 'Autre Admin', 'admin.fictif@example.com')$$,
  '23505', null, 'admin_users : e-mail unique');
select throws_ok(
  $$insert into public.admin_users (user_id, full_name, email, created_by)
    values ('00000000-0000-4000-8000-00000000a004', 'Autre Admin', 'autre.admin@example.com',
            '00000000-0000-4000-8000-00000000a004')$$,
  '23514', null, 'admin_users : un admin ne se crée pas lui-même');
select throws_ok(
  $$insert into public.admin_users (user_id, full_name, email)
    values ('00000000-0000-4000-8000-00000000a0ff', 'Sans Compte', 'sans.compte@example.com')$$,
  '23503', null, 'admin_users : compte auth.users obligatoire');
select throws_ok(
  $$insert into public.admin_users (user_id, full_name, email)
    values ('00000000-0000-4000-8000-00000000a004', 'X', 'autre.admin@example.com')$$,
  '23514', null, 'admin_users : nom trop court refusé');
select lives_ok(
  $$insert into public.admin_users (user_id, full_name, email, created_by)
    values ('00000000-0000-4000-8000-00000000a004', 'Autre Admin', 'autre.admin@example.com',
            '00000000-0000-4000-8000-00000000a001')$$,
  'admin_users : compte valide créé par un autre admin accepté');

select * from finish();
rollback;
