-- Tranche 2 — connexion : création du profil par le serveur
-- (ensure_organizer) et inscription mesurée (« organizer.signed_up » écrit
-- une seule fois, à la création, sans donnée personnelle), un organisateur
-- ne lit que SA ligne et ne modifie que son profil, seulement s'il est
-- actif ; formats D55 (validés le 2026-10-21) ; pays actif (D53).
-- Sources : docs/07 § 1.2 règle 6, § 2.1, § 11.1, § 17 (« un organisateur ne
-- lit pas le profil d'un autre », « organisateur suspendu : lecture OK,
-- écriture refusée ») ; docs/06 § 13.5, D44, D47, D51, D53, D55.
-- Données fictives (domaine réservé example.com) ; tout est annulé.
begin;
create extension if not exists pgtap with schema extensions;

select plan(55);

-- Données de test ---------------------------------------------------------------
insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-4000-8000-0000000000a1', 'Awa.Organisatrice@Example.com', now()),
  ('00000000-0000-4000-8000-0000000000b1', 'bruno.organisateur@example.com', now()),
  ('00000000-0000-4000-8000-0000000000c1', 'non.verifie@example.com', null);
insert into auth.users (id, is_anonymous) values
  ('00000000-0000-4000-8000-0000000000d1', true);
insert into public.countries (code, name, timezone, dial_code, is_active)
  values ('ZZ', 'Pays fictif', 'Africa/Abidjan', '+999', false);

-- Serveur : ensure_organizer ---------------------------------------------- (11)
set local role service_role;

select results_eq(
  $$select created, profile_complete, organizer_status::text
    from public.ensure_organizer('00000000-0000-4000-8000-0000000000a1')$$,
  $$values (true, false, 'active')$$,
  'ensure_organizer : crée la ligne, profil à remplir, compte actif'
);
select results_eq(
  $$select created, profile_complete, organizer_status::text
    from public.ensure_organizer('00000000-0000-4000-8000-0000000000a1')$$,
  $$values (false, false, 'active')$$,
  'ensure_organizer : second appel sans nouvelle création (idempotente)'
);
select results_eq(
  $$select created from public.ensure_organizer('00000000-0000-4000-8000-0000000000b1')$$,
  $$values (true)$$,
  'ensure_organizer : crée le second organisateur'
);
select results_eq(
  $$select email from public.organizers where id = '00000000-0000-4000-8000-0000000000a1'$$,
  $$values ('awa.organisatrice@example.com')$$,
  'ensure_organizer : e-mail recopié de auth.users, en minuscules'
);
select throws_ok(
  $$select * from public.ensure_organizer('00000000-0000-4000-8000-0000000000ff')$$,
  'P0002', 'unknown_user', 'ensure_organizer : compte inconnu refusé');
select throws_ok(
  $$select * from public.ensure_organizer('00000000-0000-4000-8000-0000000000c1')$$,
  'P0001', 'user_not_verified', 'ensure_organizer : e-mail non confirmé refusé');
select throws_ok(
  $$select * from public.ensure_organizer('00000000-0000-4000-8000-0000000000d1')$$,
  'P0001', 'user_not_verified', 'ensure_organizer : compte anonyme refusé');
select throws_ok(
  $$select * from public.ensure_organizer(null)$$,
  '22004', null, 'ensure_organizer : identifiant nul refusé');
select throws_ok(
  $$insert into public.organizers (id, email)
    values ('00000000-0000-4000-8000-0000000000c1', 'non.verifie@example.com')$$,
  '42501', null, 'service_role : INSERT direct refusé (création par ensure_organizer seulement)');
select throws_ok(
  $$update public.organizers set status = 'suspended', suspended_at = now()$$,
  '42501', null, 'service_role : UPDATE direct du statut refusé (suspend_organizer en tranche 8)');
select throws_ok(
  $$delete from public.organizers$$,
  '42501', null, 'service_role : DELETE direct refusé');

reset role;

-- Inscription mesurée : analytics_events (07 § 11.1) ------------------------ (5)
-- Lu en postgres : service_role n'a que INSERT sur analytics_events.
select results_eq(
  $$select count(*)::int from public.analytics_events
    where name = 'organizer.signed_up'
      and organizer_ref = '00000000-0000-4000-8000-0000000000a1'$$,
  $$values (1)$$,
  'organizer.signed_up : écrit une seule fois malgré deux appels de ensure_organizer'
);
select results_eq(
  $$select count(*)::int from public.analytics_events
    where name = 'organizer.signed_up'
      and organizer_ref = '00000000-0000-4000-8000-0000000000b1'$$,
  $$values (1)$$,
  'organizer.signed_up : écrit pour le second organisateur créé'
);
select is_empty(
  $$select id from public.analytics_events
    where organizer_ref in ('00000000-0000-4000-8000-0000000000c1',
                            '00000000-0000-4000-8000-0000000000d1',
                            '00000000-0000-4000-8000-0000000000ff')$$,
  'organizer.signed_up : rien d''écrit pour un appel refusé (inconnu, non vérifié, anonyme)'
);
select results_eq(
  $$select occurred_at = now(), event_ref, invitation_ref, event_type::text,
           country_code::text, city, properties
    from public.analytics_events
    where name = 'organizer.signed_up'
      and organizer_ref = '00000000-0000-4000-8000-0000000000a1'$$,
  $$values (true, null::uuid, null::uuid, null::text, null::text, null::text, '{}'::jsonb)$$,
  'organizer.signed_up : identifiant seul (pays, ville, propriétés vides ; même transaction)'
);
select is_empty(
  $$select ae.id from public.analytics_events ae
    where ae.organizer_ref in ('00000000-0000-4000-8000-0000000000a1',
                               '00000000-0000-4000-8000-0000000000b1')
      and (to_jsonb(ae)::text like '%@%'
           or to_jsonb(ae)::text ilike '%example%'
           or to_jsonb(ae)::text ilike '%organisat%')$$,
  'organizer.signed_up : aucune donnée personnelle (ni e-mail, ni partie de l''adresse)'
);

-- Organisateur A : lecture -------------------------------------------------- (5)
set local role authenticated;
set local "request.jwt.claims" to
  '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated","aal":"aal1"}';

select results_eq(
  'select id from public.organizers',
  $$values ('00000000-0000-4000-8000-0000000000a1'::uuid)$$,
  'organisateur : ne voit que SA ligne'
);
select is_empty(
  $$select id from public.organizers where id = '00000000-0000-4000-8000-0000000000b1'$$,
  'organisateur : la ligne d''un autre organisateur est invisible'
);
select throws_ok('select * from public.organizers', '42501', null,
  'organisateur : « select * » refusé (colonnes internes non accordées)');
select throws_ok('select suspension_reason from public.organizers', '42501', null,
  'organisateur : motif de suspension illisible');
select throws_ok('select suspended_by from public.organizers', '42501', null,
  'organisateur : auteur de la suspension illisible');

-- Organisateur A : modification du profil ----------------------------------- (4)
select lives_ok(
  $$update public.organizers
    set full_name = 'Awa Koffi', city = 'Cotonou', country_code = 'BJ'
    where id = '00000000-0000-4000-8000-0000000000a1'$$,
  'organisateur actif : remplit son profil (nom, ville, pays actif)'
);
select results_eq(
  'select full_name, city, country_code::text from public.organizers',
  $$values ('Awa Koffi', 'Cotonou', 'BJ')$$,
  'organisateur : profil enregistré'
);
select lives_ok(
  $$update public.organizers
    set full_name = 'Aïcha Diéye-N''Diaye', city = 'Grand-Bassam', country_code = 'CI'
    where id = '00000000-0000-4000-8000-0000000000a1'$$,
  'organisateur : lettres accentuées, trait d''union et apostrophe acceptés'
);
select lives_ok(
  format($$update public.organizers set full_name = %L, city = %L
           where id = '00000000-0000-4000-8000-0000000000a1'$$,
         repeat('a', 80), repeat('b', 60)),
  'organisateur : nom de 80 caractères et ville de 60 acceptés (limites D55)'
);

-- Tentative sur la ligne de B : sans effet, sans erreur (RLS).
update public.organizers set full_name = 'Nom Pirate'
  where id = '00000000-0000-4000-8000-0000000000b1';

-- Colonnes interdites ------------------------------------------------------- (7)
select throws_ok(
  $$update public.organizers set status = 'suspended' where id = '00000000-0000-4000-8000-0000000000a1'$$,
  '42501', null, 'organisateur : ne change pas son statut');
select throws_ok(
  $$update public.organizers set email = 'autre@example.com' where id = '00000000-0000-4000-8000-0000000000a1'$$,
  '42501', null, 'organisateur : ne change pas son e-mail (D51)');
select throws_ok(
  $$update public.organizers set suspended_at = null where id = '00000000-0000-4000-8000-0000000000a1'$$,
  '42501', null, 'organisateur : ne touche pas suspended_at');
select throws_ok(
  $$update public.organizers set id = '00000000-0000-4000-8000-0000000000b1' where id = '00000000-0000-4000-8000-0000000000a1'$$,
  '42501', null, 'organisateur : ne change pas son identifiant');
select throws_ok(
  $$update public.organizers set created_at = now() where id = '00000000-0000-4000-8000-0000000000a1'$$,
  '42501', null, 'organisateur : ne change pas created_at');
select throws_ok(
  $$insert into public.organizers (id, email) values ('00000000-0000-4000-8000-0000000000c1', 'x@example.com')$$,
  '42501', null, 'organisateur : INSERT refusé');
select throws_ok(
  'delete from public.organizers',
  '42501', null, 'organisateur : DELETE refusé (suppression de compte en tranche 14)');

-- Pays actif (D53) et profil complet ---------------------------------------- (3)
select throws_ok(
  $$update public.organizers set country_code = 'ZZ' where id = '00000000-0000-4000-8000-0000000000a1'$$,
  'P0001', 'country ZZ is not an active country', 'organisateur : pays inactif refusé (D53)');
select throws_ok(
  $$update public.organizers set country_code = 'QQ' where id = '00000000-0000-4000-8000-0000000000a1'$$,
  'P0001', 'country QQ is not an active country', 'organisateur : pays inconnu refusé');
select throws_ok(
  $$update public.organizers set full_name = null where id = '00000000-0000-4000-8000-0000000000a1'$$,
  '42501', null, 'organisateur : ne vide pas un champ du profil (profil complet exigé)');

-- Formats D55 (validés) ------------------------------------------------------ (9)
select throws_ok(
  $$update public.organizers set full_name = ' Awa Koffi' where id = '00000000-0000-4000-8000-0000000000a1'$$,
  '23514', null, 'nom : espace en début refusé');
select throws_ok(
  $$update public.organizers set full_name = 'A' where id = '00000000-0000-4000-8000-0000000000a1'$$,
  '23514', null, 'nom : 1 caractère refusé (2 au moins)');
select throws_ok(
  format($$update public.organizers set full_name = %L where id = '00000000-0000-4000-8000-0000000000a1'$$,
         repeat('a', 81)),
  '23514', null, 'nom : 81 caractères refusé (80 au plus)');
select throws_ok(
  $$update public.organizers set full_name = E'Awa\nKoffi' where id = '00000000-0000-4000-8000-0000000000a1'$$,
  '23514', null, 'nom : retour à la ligne refusé');
select throws_ok(
  $$update public.organizers set full_name = 'Awa  Koffi' where id = '00000000-0000-4000-8000-0000000000a1'$$,
  '23514', null, 'nom : double espace refusé');
select throws_ok(
  $$update public.organizers set full_name = '12345' where id = '00000000-0000-4000-8000-0000000000a1'$$,
  '23514', null, 'nom : au moins une lettre exigée');
select throws_ok(
  format($$update public.organizers set city = %L where id = '00000000-0000-4000-8000-0000000000a1'$$,
         repeat('b', 61)),
  '23514', null, 'ville : 61 caractères refusé (60 au plus)');
select throws_ok(
  $$update public.organizers set city = E'Coto\tnou' where id = '00000000-0000-4000-8000-0000000000a1'$$,
  '23514', null, 'ville : tabulation refusée');
select throws_ok(
  $$update public.organizers set city = 'Cotonou ' where id = '00000000-0000-4000-8000-0000000000a1'$$,
  '23514', null, 'ville : espace en fin refusé');

-- Retour à un profil réaliste avant la suspension.
update public.organizers set full_name = 'Awa Koffi', city = 'Cotonou', country_code = 'BJ'
  where id = '00000000-0000-4000-8000-0000000000a1';

reset role;

-- La tentative sur B n'a rien changé ---------------------------------------- (1)
select is(
  (select full_name from public.organizers where id = '00000000-0000-4000-8000-0000000000b1'),
  null,
  'organisateur A : sa tentative sur la ligne de B est restée sans effet'
);

-- Suspension (S3, S9) : lecture conservée, écriture sans effet ---------------- (3)
update public.organizers
  set status = 'suspended', suspended_at = now(), suspension_reason = 'Motif fictif de test'
  where id = '00000000-0000-4000-8000-0000000000a1';

set local role authenticated;
set local "request.jwt.claims" to
  '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated","aal":"aal1"}';

select results_eq(
  'select status::text, full_name from public.organizers',
  $$values ('suspended', 'Awa Koffi')$$,
  'organisateur suspendu : lit toujours sa ligne'
);

update public.organizers set city = 'Porto-Novo'
  where id = '00000000-0000-4000-8000-0000000000a1';

select results_eq(
  'select city from public.organizers',
  $$values ('Cotonou')$$,
  'organisateur suspendu : sa modification est sans effet (règle 6)'
);
select throws_ok(
  $$select * from public.ensure_organizer('00000000-0000-4000-8000-0000000000a1')$$,
  '42501', null, 'organisateur : ne peut pas appeler ensure_organizer');

reset role;

-- Connexion ultérieure d'un compte inscrit : aucun nouvel événement ---------- (2)
set local role service_role;
select results_eq(
  $$select created, profile_complete, organizer_status::text
    from public.ensure_organizer('00000000-0000-4000-8000-0000000000a1')$$,
  $$values (false, true, 'suspended')$$,
  'ensure_organizer : compte inscrit, profil complet, suspendu (connexion en lecture seule)'
);
reset role;
select results_eq(
  $$select count(*)::int from public.analytics_events
    where name = 'organizer.signed_up'
      and organizer_ref = '00000000-0000-4000-8000-0000000000a1'$$,
  $$values (1)$$,
  'organizer.signed_up : toujours une seule ligne après une connexion ultérieure'
);

-- Visiteur (anon) ----------------------------------------------------------- (3)
set local role anon;
set local "request.jwt.claims" to '{"role":"anon"}';

select throws_ok('select id from public.organizers', '42501', null,
  'anon : ne lit pas organizers');
select throws_ok(
  $$update public.organizers set full_name = 'Anonyme'$$,
  '42501', null, 'anon : ne modifie pas organizers');
select throws_ok(
  $$select * from public.ensure_organizer('00000000-0000-4000-8000-0000000000a1')$$,
  '42501', null, 'anon : ne peut pas appeler ensure_organizer');

reset role;

-- Contrainte : statut suspendu sans date refusé ------------------------------ (2)
select throws_ok(
  $$update public.organizers set status = 'suspended', suspended_at = null
    where id = '00000000-0000-4000-8000-0000000000b1'$$,
  '23514', null, 'organizers : suspendu sans suspended_at refusé');
select throws_ok(
  $$update public.organizers set email = 'Majuscules@Example.com'
    where id = '00000000-0000-4000-8000-0000000000b1'$$,
  '23514', null, 'organizers : e-mail en majuscules refusé (stocké en minuscules)');

select * from finish();
rollback;
