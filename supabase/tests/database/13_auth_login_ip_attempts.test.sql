-- Tranche 2 — refonte de la connexion : limite par IP des demandes et des
-- vérifications de code, par IPv4 ou préfixe IPv6 /64 (portée addr) et par
-- préfixe IPv6 /48 (portée v6_48) (login_ip_attempts, migration
-- 20261022120100).
-- Sources : audit security-reviewer de la tranche 2 ; décisions du porteur du
-- projet du 2026-10-22 (seuils /64 validés ; limite supplémentaire par /48,
-- R3) ; docs/06 § 7.1, D23, D52 ; docs/07 § 2.1.
-- Seuils : addr — demandes 10 / 10 min et 30 / 24 h, vérifications 20 / 10 min
-- et 60 / 24 h ; v6_48 — demandes 60 / 10 min et 200 / 24 h, vérifications
-- 120 / 10 min et 400 / 24 h (validés le 2026-10-22).
-- Empreintes fictives ; une adresse de quota différente à chaque appel
-- (repeat('1', 64)…) pour que les règles par adresse (testées dans 10) ne
-- gênent pas. Les demandes passées sont simulées en écrivant les dates en
-- tant que postgres (now() est figé dans la transaction). Tout est annulé.
begin;
create extension if not exists pgtap with schema extensions;

select plan(27);

-- Plafond global vidé (testé dans 14).
update public.login_code_global_counter set issue_times = '{}' where id;

-- Historiques simulés ------------------------------------------------------------
insert into public.login_ip_attempts (ip_hash, ip_scope, action, attempt_times) values
  -- addr, demandes : 9 dans les 10 min (la plus ancienne il y a 9 min)
  (repeat('1a', 32), 'addr', 'send_code',
     array[now() - interval '9 minutes'] || array_fill(now() - interval '5 minutes', array[8])),
  -- addr, demandes : 30 sur 24 h, aucune dans les 10 min
  (repeat('2a', 32), 'addr', 'send_code',
     array[now() - interval '23 hours'] || array_fill(now() - interval '1 hour', array[29])),
  -- addr, demandes : 30 de plus de 24 h (ne comptent plus)
  (repeat('3a', 32), 'addr', 'send_code', array_fill(now() - interval '25 hours', array[30])),
  -- addr, vérifications : 20 dans les 10 min
  (repeat('4a', 32), 'addr', 'verify_code', array_fill(now() - interval '8 minutes', array[20])),
  -- addr, vérifications : 60 sur 24 h
  (repeat('4c', 32), 'addr', 'verify_code', array_fill(now() - interval '2 hours', array[60])),
  -- /48, demandes : 60 dans les 10 min
  (repeat('5b', 32), 'v6_48', 'send_code', array_fill(now() - interval '4 minutes', array[60])),
  -- /48, demandes : 59 dans les 10 min
  (repeat('7b', 32), 'v6_48', 'send_code', array_fill(now() - interval '4 minutes', array[59])),
  -- /48, demandes : 200 sur 24 h
  (repeat('5c', 32), 'v6_48', 'send_code', array_fill(now() - interval '3 hours', array[200])),
  -- /48, vérifications : 120 dans les 10 min
  (repeat('5d', 32), 'v6_48', 'verify_code', array_fill(now() - interval '1 minute', array[120])),
  -- /48, vérifications : 400 sur 24 h
  (repeat('5e', 32), 'v6_48', 'verify_code', array_fill(now() - interval '5 hours', array[400])),
  -- addr, demandes : 10 dans les 10 min (limite atteinte), /48 libre
  (repeat('9a', 32), 'addr', 'send_code', array_fill(now() - interval '1 minute', array[10]));

set local role service_role;

-- addr (IPv4 ou /64) : demandes ---------------------------------------------- (7)
select results_eq(
  $$select allowed, reason
    from public.login_code_issue(repeat('1', 64), repeat('1a', 32), null, repeat('c1', 32), 'ip.test@example.com')$$,
  $$values (true, 'ok')$$,
  '10e demande en 10 min pour une IP : acceptée'
);
select results_eq(
  $$select allowed, reason, retry_at, deliver
    from public.login_code_issue(repeat('2', 64), repeat('1a', 32), null, repeat('c1', 32), 'ip.test@example.com')$$,
  $$values (false, 'ip_limited', now() + interval '1 minute', false)$$,
  '11e demande en 10 min, autre adresse : refusée (ip_limited) jusqu''à la sortie de la plus ancienne'
);

reset role;
select is(
  (select cardinality(attempt_times) from public.login_ip_attempts
   where ip_hash = repeat('1a', 32) and ip_scope = 'addr' and action = 'send_code'),
  10,
  'une demande refusée par l''IP n''est pas comptée'
);
select is((select count(*)::integer from public.login_attempts where identifier_hash = repeat('2', 64)), 0,
  'IP limitée : l''adresse n''est pas touchée (ni envoi consommé ni blocage possible)');
set local role service_role;

select results_eq(
  $$select allowed, reason, retry_at
    from public.login_code_issue(repeat('3', 64), repeat('2a', 32), null, repeat('c1', 32), 'ip.test@example.com')$$,
  $$values (false, 'ip_limited', now() + interval '1 hour')$$,
  '31e demande en 24 h : refusée jusqu''à la sortie de la plus ancienne de la fenêtre de 24 h'
);
select results_eq(
  $$select allowed, reason
    from public.login_code_issue(repeat('4', 64), repeat('3a', 32), null, repeat('c1', 32), 'ip.test@example.com')$$,
  $$values (true, 'ok')$$,
  'demandes de plus de 24 h : ne comptent plus'
);

reset role;
select is(
  (select attempt_times from public.login_ip_attempts
   where ip_hash = repeat('3a', 32) and ip_scope = 'addr' and action = 'send_code'),
  array[now()],
  'dates de plus de 24 h retirées, nouvelle demande enregistrée'
);
set local role service_role;

-- addr : vérifications ------------------------------------------------------ (3)
select results_eq(
  $$select result, retry_at
    from public.login_code_verify(repeat('5', 64), repeat('4a', 32), null, repeat('c1', 32), 'ip.test@example.com')$$,
  $$values ('ip_limited', now() + interval '2 minutes')$$,
  '21e vérification en 10 min pour une IP : refusée (ip_limited)'
);

reset role;
select is((select count(*)::integer from public.login_attempts where identifier_hash = repeat('5', 64)), 0,
  'vérification refusée par l''IP : aucun échec compté pour l''adresse (pas de blocage à distance)');
set local role service_role;

select results_eq(
  $$select result, retry_at
    from public.login_code_verify(repeat('6', 64), repeat('4c', 32), null, repeat('c1', 32), 'ip.test@example.com')$$,
  $$values ('ip_limited', now() + interval '22 hours')$$,
  '61e vérification en 24 h : refusée'
);

-- /48 : demandes ------------------------------------------------------------- (6)
select results_eq(
  $$select allowed, reason, retry_at
    from public.login_code_issue(repeat('7', 64), repeat('5a', 32), repeat('5b', 32), repeat('c1', 32), 'ip.test@example.com')$$,
  $$values (false, 'ip_limited', now() + interval '6 minutes')$$,
  '/48 : 61e demande en 10 min, depuis un /64 neuf : refusée'
);
select results_eq(
  $$select allowed, reason
    from public.login_code_issue(repeat('8', 64), repeat('6a', 32), repeat('5b', 32), repeat('c1', 32), 'ip.test@example.com')$$,
  $$values (false, 'ip_limited')$$,
  '/48 : changer de /64 dans le même /48 ne contourne pas la limite'
);

reset role;
select is(
  (select attempt_times from public.login_ip_attempts
   where ip_hash = repeat('5a', 32) and ip_scope = 'addr' and action = 'send_code'),
  '{}'::timestamptz[],
  '/48 refuse : la demande n''est pas comptée non plus pour le /64'
);
set local role service_role;

select results_eq(
  $$select allowed, reason
    from public.login_code_issue(repeat('9', 64), repeat('7a', 32), repeat('7b', 32), repeat('c1', 32), 'ip.test@example.com')$$,
  $$values (true, 'ok')$$,
  '/48 : 60e demande en 10 min : acceptée'
);

reset role;
select results_eq(
  $$select ip_scope, cardinality(attempt_times)
    from public.login_ip_attempts
    where (ip_hash, ip_scope) in ((repeat('7a', 32), 'addr'), (repeat('7b', 32), 'v6_48'))
      and action = 'send_code'
    order by ip_scope$$,
  $$values ('addr', 1), ('v6_48', 60)$$,
  'demande acceptée : comptée pour le /64 et pour le /48'
);
set local role service_role;

select results_eq(
  $$select allowed, reason, retry_at
    from public.login_code_issue(repeat('a1', 32), repeat('5f', 32), repeat('5c', 32), repeat('c1', 32), 'ip.test@example.com')$$,
  $$values (false, 'ip_limited', now() + interval '21 hours')$$,
  '/48 : 201e demande en 24 h : refusée'
);

-- /48 : vérifications ------------------------------------------------------- (2)
select results_eq(
  $$select result, retry_at
    from public.login_code_verify(repeat('a2', 32), repeat('6f', 32), repeat('5d', 32), repeat('c1', 32), 'ip.test@example.com')$$,
  $$values ('ip_limited', now() + interval '9 minutes')$$,
  '/48 : 121e vérification en 10 min : refusée'
);
select results_eq(
  $$select result, retry_at
    from public.login_code_verify(repeat('a3', 32), repeat('7f', 32), repeat('5e', 32), repeat('c1', 32), 'ip.test@example.com')$$,
  $$values ('ip_limited', now() + interval '19 hours')$$,
  '/48 : 401e vérification en 24 h : refusée'
);

-- /64 limité, /48 libre ------------------------------------------------------ (2)
select results_eq(
  $$select allowed, reason
    from public.login_code_issue(repeat('a4', 32), repeat('9a', 32), repeat('9b', 32), repeat('c1', 32), 'ip.test@example.com')$$,
  $$values (false, 'ip_limited')$$,
  '/64 à sa limite : refus même si le /48 est libre'
);

reset role;
select is(
  (select attempt_times from public.login_ip_attempts
   where ip_hash = repeat('9b', 32) and ip_scope = 'v6_48' and action = 'send_code'),
  '{}'::timestamptz[],
  '/64 refuse : la demande n''est pas comptée pour le /48'
);
set local role service_role;

-- Demande admise par l'IP puis refusée pour l'adresse : comptée pour l'IP --- (2)
select results_eq(
  $$select reason
    from public.login_code_issue(repeat('a5', 32), repeat('8a', 32), null, repeat('c1', 32), 'ip.test@example.com')
    union all
    select reason
    from public.login_code_issue(repeat('a5', 32), repeat('8a', 32), null, repeat('c2', 32), 'ip.test@example.com')$$,
  $$values ('ok'), ('too_soon')$$,
  'même adresse deux fois : ok puis too_soon'
);

reset role;
select is(
  (select cardinality(attempt_times) from public.login_ip_attempts
   where ip_hash = repeat('8a', 32) and ip_scope = 'addr' and action = 'send_code'),
  2,
  'la demande refusée pour l''adresse compte quand même pour l''IP (sonder coûte)'
);

-- Seuils (un seul endroit) --------------------------------------------------- (2)
select results_eq(
  $$select l.short_window, l.short_max, l.long_window, l.long_max
    from (values (1, 'addr', 'send_code'), (2, 'addr', 'verify_code'),
                 (3, 'v6_48', 'send_code'), (4, 'v6_48', 'verify_code')) as v(n, scope, action)
    cross join lateral private.login_ip_limits(v.scope, v.action) as l
    order by v.n$$,
  $$values (interval '10 minutes', 10, interval '24 hours', 30),
           (interval '10 minutes', 20, interval '24 hours', 60),
           (interval '10 minutes', 60, interval '24 hours', 200),
           (interval '10 minutes', 120, interval '24 hours', 400)$$,
  'seuils validés : /64 (10/30, 20/60) ; /48 (60/200, 120/400)'
);
select throws_ok(
  $$select * from private.login_ip_limits('v6_56', 'send_code')$$,
  '22023', null, 'portée inconnue refusée');

-- Purge (48 h) et format ----------------------------------------------------- (3)
insert into public.login_ip_attempts (ip_hash, ip_scope, action, updated_at)
  values (repeat('99', 32), 'addr', 'send_code', now() - interval '49 hours');
select cmp_ok(private.purge_login_attempts(), '>=', 1, 'purge : lancée sans erreur, au moins une ligne supprimée');

select is(
  (select count(*)::integer from public.login_ip_attempts where ip_hash = repeat('99', 32)),
  0,
  'purge : ligne d''IP inactive depuis plus de 48 h supprimée'
);
select throws_ok(
  $$insert into public.login_ip_attempts (ip_hash, ip_scope, action) values ('203.0.113.7', 'addr', 'send_code')$$,
  '23514', null, 'contrainte : une IP en clair ne peut pas être stockée');

select * from finish();
rollback;
