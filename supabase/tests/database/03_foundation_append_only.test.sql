-- Tranche 1 — socle : audit_log en ajout seul ; analytics_events écrit par
-- le serveur seul, sans donnée personnelle, modifiable seulement pour mettre
-- invitation_ref à NULL (docs/07 § 2.5, § 11.1, § 16, § 17).
begin;
create extension if not exists pgtap with schema extensions;

select plan(29);

-- Déclencheurs présents --------------------------------------------------- (2)
select has_trigger('public', 'audit_log', 'audit_log_reject_update_delete',
  'audit_log : déclencheur BEFORE UPDATE OR DELETE');
select has_trigger('public', 'audit_log', 'audit_log_reject_truncate',
  'audit_log : déclencheur BEFORE TRUNCATE');

-- audit_log : même le propriétaire de la table ne modifie rien ------------ (5)
select lives_ok(
  $$insert into public.audit_log (actor_kind, action, details)
    values ('system', 'test.inserted', '{"note": "ligne de test"}')$$,
  'audit_log : INSERT accepté');
select throws_ok(
  $$update public.audit_log set action = 'test.rewritten' where action = 'test.inserted'$$,
  'P0001', null, 'audit_log : UPDATE refusé par le déclencheur');
select throws_ok(
  $$delete from public.audit_log where action = 'test.inserted'$$,
  'P0001', null, 'audit_log : DELETE refusé par le déclencheur');
select throws_ok(
  'truncate public.audit_log',
  'P0001', null, 'audit_log : TRUNCATE refusé par le déclencheur');
select is(
  (select count(*) from public.audit_log where action = 'test.inserted'),
  1::bigint,
  'audit_log : la ligne est intacte');

-- audit_log : contraintes ------------------------------------------------- (4)
select throws_ok(
  $$insert into public.audit_log (actor_kind, action) values ('admin', 'role.grant')$$,
  '23514', null, 'audit_log : acte admin sans actor_id refusé');
select throws_ok(
  $$insert into public.audit_log (actor_id, actor_kind, action)
    values ('00000000-0000-4000-8000-000000000001', 'system', 'test.inserted')$$,
  '23514', null, 'audit_log : acte système avec actor_id refusé');
select throws_ok(
  $$insert into public.audit_log (actor_kind, action) values ('hacker', 'test.inserted')$$,
  '23514', null, 'audit_log : actor_kind hors liste refusé');
select throws_ok(
  $$insert into public.audit_log (actor_kind, action, details) values ('system', 'test.inserted', '[]')$$,
  '23514', null, 'audit_log : details non objet refusé');

-- audit_log : le serveur (service_role) ajoute mais ne modifie pas ------- (3)
set local role service_role;
select lives_ok(
  $$insert into public.audit_log (actor_kind, action) values ('system', 'test.by_server')$$,
  'service_role : INSERT audit_log accepté');
select throws_ok(
  $$update public.audit_log set action = 'test.rewritten'$$,
  '42501', null, 'service_role : UPDATE audit_log refusé');
select throws_ok(
  'delete from public.audit_log',
  '42501', null, 'service_role : DELETE audit_log refusé');
reset role;

-- analytics_events : liste blanche des noms et des propriétés ------------ (6)
select lives_ok(
  $$insert into public.analytics_events
      (name, organizer_ref, event_ref, invitation_ref, event_type, country_code, city, properties)
    values ('payment.approved',
            '00000000-0000-4000-8000-0000000000a1',
            '00000000-0000-4000-8000-0000000000b1',
            '00000000-0000-4000-8000-0000000000c1',
            'wedding', 'BJ', 'Cotonou',
            '{"tier_seats": 100, "template_slug": "wedding-royal", "channel": "whatsapp", "amount_rounded": 19000}')$$,
  'analytics_events : événement conforme accepté');
select throws_ok(
  $$insert into public.analytics_events (name, properties) values ('rsvp.answered', '{"phone": "+22990000000"}')$$,
  '23514', null, 'analytics_events : clé hors liste blanche refusée');
select throws_ok(
  $$insert into public.analytics_events (name, properties) values ('rsvp.answered', '{"channel": "+22990000000"}')$$,
  '23514', null, 'analytics_events : numéro dans une propriété refusé');
select throws_ok(
  $$insert into public.analytics_events (name, properties) values ('rsvp.answered', '{"channel": {"name": "Awa"}}')$$,
  '23514', null, 'analytics_events : valeur imbriquée refusée');
select throws_ok(
  $$insert into public.analytics_events (name, properties) values ('rsvp.answered', '{"amount_rounded": 1.5}')$$,
  '23514', null, 'analytics_events : montant non entier refusé');
select throws_ok(
  $$insert into public.analytics_events (name) values ('guest.exported')$$,
  '23514', null, 'analytics_events : nom d''événement hors liste refusé');

-- analytics_events : ajout seul, sauf invitation_ref -> NULL ------------- (6)
select throws_ok(
  $$update public.analytics_events set name = 'payment.failed' where name = 'payment.approved'$$,
  'P0001', null, 'analytics_events : UPDATE d''une colonne refusé');
select lives_ok(
  $$update public.analytics_events set invitation_ref = null
    where invitation_ref = '00000000-0000-4000-8000-0000000000c1'$$,
  'analytics_events : mise à NULL de invitation_ref acceptée');
select is(
  (select count(*) from public.analytics_events
    where name = 'payment.approved' and invitation_ref is null
      and event_ref = '00000000-0000-4000-8000-0000000000b1'),
  1::bigint,
  'analytics_events : invitation_ref effacée, le reste conservé');
select throws_ok(
  $$update public.analytics_events set invitation_ref = '00000000-0000-4000-8000-0000000000c2'
    where event_ref = '00000000-0000-4000-8000-0000000000b1'$$,
  'P0001', null, 'analytics_events : réattribuer invitation_ref refusé');
select throws_ok(
  $$delete from public.analytics_events where event_ref = '00000000-0000-4000-8000-0000000000b1'$$,
  'P0001', null, 'analytics_events : DELETE refusé');
select throws_ok(
  'truncate public.analytics_events',
  'P0001', null, 'analytics_events : TRUNCATE refusé');

-- analytics_events : le serveur ajoute seulement ------------------------- (3)
set local role service_role;
select lives_ok(
  $$insert into public.analytics_events (name, properties) values ('event.created', '{"template_slug": "wedding-royal"}')$$,
  'service_role : INSERT analytics_events accepté');
select throws_ok(
  $$update public.analytics_events set invitation_ref = null$$,
  '42501', null, 'service_role : UPDATE analytics_events refusé (réservé à la fonction de suppression)');
select throws_ok(
  'delete from public.analytics_events',
  '42501', null, 'service_role : DELETE analytics_events refusé');
reset role;

select * from finish();
rollback;
