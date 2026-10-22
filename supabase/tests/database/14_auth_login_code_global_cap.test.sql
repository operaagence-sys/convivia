-- Tranche 2 — refonte de la connexion : plafond global de 300 codes par heure
-- glissante pour toute la plateforme, avec événement d'alerte
-- (login_code_global_counter, audit_log ; migration 20261022120100).
-- Sources : décision R3 du porteur du projet du 2026-10-22 (plafond global
-- 300 / h, refus neutre pour tous, événement fixe pour l'alerte) ; revue de
-- conception du security-reviewer ; docs/07 § 2.5 (audit_log), § 2.1.
-- Les codes déjà émis sont simulés en écrivant les dates en tant que postgres
-- (now() est figé dans la transaction). Les événements écrits par ce test
-- sont repérés par occurred_at = now() (date de la transaction). Empreintes
-- fictives ; adresse du domaine réservé example.com. Tout est annulé.
begin;
create extension if not exists pgtap with schema extensions;

select plan(20);

-- Événements d'alerte écrits dans cette transaction.
create function pg_temp.alerts()
returns integer
language sql
as $$
  select count(*)::integer from public.audit_log
  where action = 'auth.login_code_global_cap_reached' and occurred_at = now()
$$;

-- 300 codes dans l'heure (le plus ancien il y a 59 min), aucune alerte.
update public.login_code_global_counter
  set issue_times = array[now() - interval '59 minutes'] || array_fill(now() - interval '10 minutes', array[299]),
      cap_alerted_at = null
  where id;

set local role service_role;

-- Plafond atteint : refus neutre pour tous ------------------------------------ (7)
select results_eq(
  $$select allowed, reason, retry_at, deliver
    from public.login_code_issue(repeat('1', 64), repeat('11', 32), null, repeat('c1', 32), 'plafond.global@example.com')$$,
  $$values (false, 'global_cap', now() + interval '1 minute', false)$$,
  '301e code dans l''heure : refusé (global_cap) jusqu''à la sortie du plus ancien'
);
select results_eq(
  $$select allowed, reason
    from public.login_code_issue(repeat('2', 64), repeat('22', 32), repeat('2b', 32), repeat('c1', 32), 'autre.adresse@example.com')$$,
  $$values (false, 'global_cap')$$,
  'plafond global : refus pour toute adresse et toute IP'
);

reset role;
select results_eq(
  $$select actor_kind, actor_id, target_table, target_id, ip_hash, details
    from public.audit_log
    where action = 'auth.login_code_global_cap_reached' and occurred_at = now()$$,
  $$values ('system'::text, null::uuid, null::text, null::uuid, null::text,
            '{"limit": 300, "window_minutes": 60}'::jsonb)$$,
  'événement fixe « auth.login_code_global_cap_reached » écrit une seule fois, sans donnée personnelle'
);
select is(
  (select cap_alerted_at from public.login_code_global_counter where id),
  now(),
  'date de la dernière alerte enregistrée'
);
select is(
  (select cardinality(issue_times) from public.login_code_global_counter where id),
  300,
  'codes refusés par le plafond : non comptés'
);
select is((select count(*)::integer from public.login_attempts where identifier_hash in (repeat('1', 64), repeat('2', 64))), 0,
  'plafond global : les adresses ne sont pas touchées (ni envoi consommé)');
select is(
  (select cardinality(attempt_times) from public.login_ip_attempts
   where ip_hash = repeat('11', 32) and ip_scope = 'addr' and action = 'send_code'),
  1,
  'la demande, admise par l''IP, compte pour l''IP (limite IP contrôlée avant le plafond global)'
);

-- Fenêtre glissante ---------------------------------------------------------- (4)
update public.login_code_global_counter
  set issue_times = array[now() - interval '61 minutes'] || array_fill(now() - interval '10 minutes', array[299])
  where id;
set local role service_role;

select results_eq(
  $$select allowed, reason, deliver
    from public.login_code_issue(repeat('3', 64), repeat('33', 32), null, repeat('c1', 32), 'plafond.global@example.com')$$,
  $$values (true, 'ok', true)$$,
  'un code de plus d''une heure ne compte plus : 300e code de l''heure accepté'
);

reset role;
select is(
  (select issue_times[cardinality(issue_times)] = now() and cardinality(issue_times) = 300
   from public.login_code_global_counter where id),
  true,
  'code émis : ajouté au compteur global, l''ancien retiré'
);
set local role service_role;

select results_eq(
  $$select allowed, reason
    from public.login_code_issue(repeat('4', 64), repeat('44', 32), null, repeat('c1', 32), 'plafond.global@example.com')$$,
  $$values (false, 'global_cap')$$,
  'de nouveau 300 dans l''heure : refusé'
);

reset role;
select is(pg_temp.alerts(), 1, 'moins d''une heure après la dernière alerte : pas de nouvel événement');

-- Nouvelle alerte une heure plus tard ---------------------------------------- (2)
update public.login_code_global_counter
  set cap_alerted_at = now() - interval '61 minutes'
  where id;
set local role service_role;

select results_eq(
  $$select reason
    from public.login_code_issue(repeat('5', 64), repeat('55', 32), null, repeat('c1', 32), 'plafond.global@example.com')$$,
  $$values ('global_cap')$$,
  'toujours au plafond : refusé'
);

reset role;
select is(pg_temp.alerts(), 2, 'plus d''une heure après la dernière alerte : un nouvel événement');

-- Ordre des contrôles -------------------------------------------------------- (3)
insert into public.login_ip_attempts (ip_hash, ip_scope, action, attempt_times)
  values (repeat('66', 32), 'addr', 'send_code', array_fill(now() - interval '1 minute', array[10]));
insert into public.login_attempts (identifier_hash, failed_count, locked_until)
  values (repeat('7', 64), 5, now() + interval '10 minutes');
set local role service_role;

select results_eq(
  $$select reason
    from public.login_code_issue(repeat('6', 64), repeat('66', 32), null, repeat('c1', 32), 'plafond.global@example.com')$$,
  $$values ('ip_limited')$$,
  'IP limitée et plafond atteint : ip_limited (l''IP est contrôlée en premier)'
);
select results_eq(
  $$select reason
    from public.login_code_issue(repeat('7', 64), repeat('77', 32), null, repeat('c1', 32), 'plafond.global@example.com')$$,
  $$values ('global_cap')$$,
  'adresse bloquée et plafond atteint : global_cap (le plafond est contrôlé avant l''adresse)'
);

reset role;
update public.login_code_global_counter set issue_times = '{}' where id;
set local role service_role;

select results_eq(
  $$select reason
    from public.login_code_issue(repeat('7', 64), repeat('78', 32), null, repeat('c1', 32), 'plafond.global@example.com')$$,
  $$values ('locked')$$,
  'sous le plafond : la règle de l''adresse (blocage) s''applique'
);

-- Comptage des codes émis ---------------------------------------------------- (2)
select results_eq(
  $$select reason
    from public.login_code_issue(repeat('8', 64), repeat('88', 32), null, repeat('c1', 32), 'plafond.global@example.com')$$,
  $$values ('ok')$$,
  'compteur vide : code accepté'
);

reset role;
select is((select cardinality(issue_times) from public.login_code_global_counter where id), 1,
  'seuls les codes émis sont comptés (les refus pour l''adresse ne le sont pas)');

-- Réglages (un seul endroit) ------------------------------------------------- (2)
select results_eq(
  $$select code_ttl, resend_interval, hourly_window, hourly_max, max_failures, lock_duration,
           global_window, global_max
    from private.login_code_settings()$$,
  $$values (interval '10 minutes', interval '60 seconds', interval '1 hour', 3, 5,
            interval '15 minutes', interval '1 hour', 300)$$,
  'réglages : 10 min, 60 s, 3 / h, 5 échecs → 15 min (D52) ; plafond global 300 / h'
);
select throws_ok(
  $$update public.login_code_global_counter
      set issue_times = array_fill(now(), array[301])
      where id$$,
  '23514', null, 'contrainte : le compteur global ne garde jamais plus de 300 dates');

select * from finish();
rollback;
