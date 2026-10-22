-- Tranche 2 — connexion : codes de connexion fabriqués par Convivia, règles
-- par adresse (login_code_issue / login_code_verify, migration
-- 20261022120100).
-- Sources : docs/07 § 2.1, § 17 (« 6e code faux refusé pendant 15 min, même
-- pour un identifiant sans compte ») ; docs/06 § 7.1, D23, D24, D52 ;
-- décision du porteur du projet et revue de conception du security-reviewer
-- (2026-10-22).
-- Données fictives : empreintes repeat(...) qui ne correspondent à aucune
-- adresse réelle, adresses du domaine réservé example.com, sans compte. Une
-- IP fictive par adresse (repeat('a0', 32) pour 'a'…), IPv4 (pas de /48),
-- pour que la limite par IP (testée dans 13) ne gêne pas les règles testées
-- ici. Les empreintes de code (repeat('c1', 32)…) tiennent lieu de
-- HMAC(LOGIN_CODE_PEPPER, …) : la base ne voit jamais un code en clair.
-- now() est figé dans une transaction : les écoulements de temps sont
-- simulés en réécrivant les dates en tant que postgres. Tout est annulé.
begin;
create extension if not exists pgtap with schema extensions;

select plan(56);

-- Plafond global vidé (testé dans 14) : les règles par adresse seules jouent.
update public.login_code_global_counter set issue_times = '{}' where id;

-- Émission (login_code_issue) ----------------------------------------------- (10)
set local role service_role;

select results_eq(
  $$select allowed, reason, retry_at, deliver
    from public.login_code_issue(repeat('a', 64), repeat('a0', 32), null, repeat('c1', 32), 'organisateur.a@example.com')$$,
  $$values (true, 'ok', now() + interval '60 seconds', true)$$,
  '1er code : accepté, même sans compte ; prochain renvoi dans 60 s ; e-mail à envoyer'
);

reset role;
select results_eq(
  $$select code_hmac, code_expires_at from public.login_attempts where identifier_hash = repeat('a', 64)$$,
  $$values (repeat('c1', 32), now() + interval '10 minutes')$$,
  'seule l''empreinte reçue est enregistrée, valable 10 min (le code est tiré dans Node)'
);
set local role service_role;

select results_eq(
  $$select allowed, reason, retry_at, deliver
    from public.login_code_issue(repeat('a', 64), repeat('a0', 32), null, repeat('c2', 32), 'organisateur.a@example.com')$$,
  $$values (false, 'too_soon', now() + interval '60 seconds', false)$$,
  'nouvel envoi avant 60 s : refusé (too_soon), sans être compté'
);
select results_eq(
  $$select allowed, reason
    from public.login_code_issue(repeat('a', 64), repeat('a0', 32), null, repeat('c2', 32), 'organisateur.a+promo@example.com')$$,
  $$values (false, 'too_soon')$$,
  'variante « +tag » (même empreinte de quota) : même délai de 60 s'
);

reset role;
update public.login_attempts
  set send_times = array[now() - interval '50 minutes', now() - interval '2 minutes']
  where identifier_hash = repeat('a', 64);
set local role service_role;

select results_eq(
  $$select allowed, reason, retry_at, deliver
    from public.login_code_issue(repeat('a', 64), repeat('a0', 32), null, repeat('c2', 32), 'organisateur.a@example.com')$$,
  $$values (true, 'ok', now() + interval '10 minutes', true)$$,
  '3e code dans l''heure : accepté ; prochain envoi possible à la sortie du plus ancien de la fenêtre'
);

reset role;
select is(
  (select code_hmac from public.login_attempts where identifier_hash = repeat('a', 64)),
  repeat('c2', 32),
  'le nouveau code remplace le précédent (un seul code actif par adresse)'
);
set local role service_role;

select results_eq(
  $$select allowed, reason, retry_at, deliver
    from public.login_code_issue(repeat('a', 64), repeat('a0', 32), null, repeat('c3', 32), 'organisateur.a+promo@example.com')$$,
  $$values (false, 'hourly_cap', now() + interval '10 minutes', false)$$,
  '4e code dans l''heure, par une variante « +tag » : refusé (hourly_cap, quota partagé, D52)'
);

reset role;
select is(
  (select cardinality(send_times) from public.login_attempts where identifier_hash = repeat('a', 64)),
  3,
  'les envois refusés ne sont pas enregistrés (3 envois dans l''heure)'
);
update public.login_attempts
  set send_times = array[now() - interval '61 minutes', now() - interval '30 minutes', now() - interval '20 minutes']
  where identifier_hash = repeat('a', 64);
set local role service_role;

select results_eq(
  $$select allowed, reason
    from public.login_code_issue(repeat('a', 64), repeat('a0', 32), null, repeat('c3', 32), 'organisateur.a@example.com')$$,
  $$values (true, 'ok')$$,
  'heure glissante : un envoi de plus d''une heure ne compte plus'
);

reset role;
select is(
  (select send_times from public.login_attempts where identifier_hash = repeat('a', 64)),
  array[now() - interval '30 minutes', now() - interval '20 minutes', now()],
  'heure glissante : l''envoi ancien est retiré, le nouveau ajouté'
);
set local role service_role;

-- Arguments mal formés (bogue de la route, erreur 22023) -------------------- (7)
select throws_ok(
  $$select * from public.login_code_issue('pas-une-empreinte', repeat('a0', 32), null, repeat('c1', 32), 'x@example.com')$$,
  '22023', null, 'empreinte d''adresse mal formée refusée');
select throws_ok(
  $$select * from public.login_code_issue(upper(repeat('ab', 32)), repeat('a0', 32), null, repeat('c1', 32), 'x@example.com')$$,
  '22023', null, 'empreinte en majuscules refusée (hexadécimal minuscule attendu)');
select throws_ok(
  $$select * from public.login_code_issue(repeat('a', 64), repeat('a0', 32), null, '123456', 'x@example.com')$$,
  '22023', null, 'un code en clair à la place de son empreinte est refusé');
select throws_ok(
  $$select * from public.login_code_issue(repeat('a', 64), repeat('a0', 32), null, repeat('c1', 32), 'Organisateur.A@Example.com')$$,
  '22023', null, 'e-mail non normalisé (majuscules) refusé');
select throws_ok(
  $$select * from public.login_code_issue(repeat('a', 64), 'pas-une-ip', null, repeat('c1', 32), 'x@example.com')$$,
  '22023', null, 'empreinte d''IP mal formée refusée');
select throws_ok(
  $$select * from public.login_code_issue(repeat('a', 64), repeat('a0', 32), 'pas-un-48', repeat('c1', 32), 'x@example.com')$$,
  '22023', null, 'empreinte de /48 mal formée refusée');
select throws_ok(
  $$select * from public.login_code_verify(repeat('a', 64), repeat('a0', 32), null, '123456', 'x@example.com')$$,
  '22023', null, 'vérification : un code en clair à la place de son empreinte est refusé');

-- Vérification : code juste, usage unique, code faux ------------------------ (6)
select results_eq(
  $$select allowed, reason
    from public.login_code_issue(repeat('b', 64), repeat('b0', 32), null, repeat('c1', 32), 'organisateur.b@example.com')$$,
  $$values (true, 'ok')$$,
  'adresse b : code émis'
);
select results_eq(
  $$select result, retry_at
    from public.login_code_verify(repeat('b', 64), repeat('b0', 32), null, repeat('c9', 32), 'organisateur.b@example.com')$$,
  $$values ('wrong', null::timestamptz)$$,
  'code faux : wrong'
);

reset role;
select is((select failed_count from public.login_attempts where identifier_hash = repeat('b', 64)), 1::smallint,
  'code faux : un échec compté');
set local role service_role;

select results_eq(
  $$select result, retry_at
    from public.login_code_verify(repeat('b', 64), repeat('b0', 32), null, repeat('c1', 32), 'organisateur.b@example.com')$$,
  $$values ('ok', null::timestamptz)$$,
  'code juste : ok'
);

reset role;
select results_eq(
  $$select code_hmac is null, code_expires_at is null, failed_count
    from public.login_attempts where identifier_hash = repeat('b', 64)$$,
  $$values (true, true, 0::smallint)$$,
  'code juste : consommé (effacé) et échecs remis à zéro, dans la même transaction'
);
set local role service_role;

select results_eq(
  $$select result
    from public.login_code_verify(repeat('b', 64), repeat('b0', 32), null, repeat('c1', 32), 'organisateur.b@example.com')$$,
  $$values ('wrong')$$,
  'usage unique : le même code une seconde fois → wrong'
);

-- Expiration (10 min) ------------------------------------------------------- (3)
select results_eq(
  $$select allowed, reason
    from public.login_code_issue(repeat('c', 64), repeat('c0', 32), null, repeat('c1', 32), 'organisateur.c@example.com')$$,
  $$values (true, 'ok')$$,
  'adresse c : code émis'
);

reset role;
update public.login_attempts
  set code_expires_at = now() - interval '1 second'
  where identifier_hash = repeat('c', 64);
set local role service_role;

select results_eq(
  $$select result
    from public.login_code_verify(repeat('c', 64), repeat('c0', 32), null, repeat('c1', 32), 'organisateur.c@example.com')$$,
  $$values ('wrong')$$,
  'code juste mais expiré (plus de 10 min) : wrong'
);

reset role;
select results_eq(
  $$select code_hmac is null, failed_count from public.login_attempts where identifier_hash = repeat('c', 64)$$,
  $$values (true, 1::smallint)$$,
  'code expiré : effacé, échec compté'
);
set local role service_role;

-- Blocage : 5 échecs, même sans code ni compte (07 § 17) -------------------- (12)
select results_eq(
  $$select result
    from public.login_code_verify(repeat('d', 64), repeat('d0', 32), null, repeat('c1', 32), 'inconnu.d@example.com')$$,
  $$values ('wrong')$$,
  'adresse sans compte et sans code : wrong'
);

reset role;
select is((select failed_count from public.login_attempts where identifier_hash = repeat('d', 64)), 1::smallint,
  'échec compté même sans code actif ni compte (D23)');
set local role service_role;

select results_eq(
  $$select result from public.login_code_verify(repeat('d', 64), repeat('d0', 32), null, repeat('c1', 32), 'inconnu.d@example.com')$$,
  $$values ('wrong')$$, '2e échec : wrong');
select results_eq(
  $$select result from public.login_code_verify(repeat('d', 64), repeat('d0', 32), null, repeat('c1', 32), 'inconnu.d@example.com')$$,
  $$values ('wrong')$$, '3e échec : wrong');
select results_eq(
  $$select result from public.login_code_verify(repeat('d', 64), repeat('d0', 32), null, repeat('c1', 32), 'inconnu.d+x@example.com')$$,
  $$values ('wrong')$$, '4e échec, par une variante « +tag » : wrong (compteur partagé)');
select results_eq(
  $$select result, retry_at
    from public.login_code_verify(repeat('d', 64), repeat('d0', 32), null, repeat('c1', 32), 'inconnu.d@example.com')$$,
  $$values ('locked', now() + interval '15 minutes')$$,
  '5e échec : blocage de 15 min (locked)'
);
select results_eq(
  $$select result, retry_at
    from public.login_code_verify(repeat('d', 64), repeat('d0', 32), null, repeat('c1', 32), 'inconnu.d@example.com')$$,
  $$values ('locked', now() + interval '15 minutes')$$,
  '6e tentative pendant le blocage : refusée sans vérification (07 § 17)'
);
select results_eq(
  $$select allowed, reason, retry_at, deliver
    from public.login_code_issue(repeat('d', 64), repeat('d0', 32), null, repeat('c2', 32), 'inconnu.d@example.com')$$,
  $$values (false, 'locked', now() + interval '15 minutes', false)$$,
  'pendant le blocage : aucun nouvel envoi (D52)'
);

reset role;
select results_eq(
  $$select failed_count, locked_until, cardinality(send_times)
    from public.login_attempts where identifier_hash = repeat('d', 64)$$,
  $$values (5::smallint, now() + interval '15 minutes', 0)$$,
  'blocage : 5 échecs, fin dans 15 min ; l''envoi refusé n''est pas enregistré'
);
update public.login_attempts
  set locked_until = now() - interval '1 second'
  where identifier_hash = repeat('d', 64);
set local role service_role;

select results_eq(
  $$select allowed, reason
    from public.login_code_issue(repeat('d', 64), repeat('d0', 32), null, repeat('c2', 32), 'inconnu.d@example.com')$$,
  $$values (true, 'ok')$$,
  'blocage échu : envoi de nouveau possible'
);

reset role;
select is((select failed_count from public.login_attempts where identifier_hash = repeat('d', 64)), 0::smallint,
  'blocage échu : compteur remis à zéro');
set local role service_role;

select results_eq(
  $$select result
    from public.login_code_verify(repeat('d', 64), repeat('d0', 32), null, repeat('c2', 32), 'inconnu.d@example.com')$$,
  $$values ('ok')$$,
  'après le blocage, le nouveau code est accepté'
);

-- Blocage avec un code actif : le code est effacé ---------------------------- (4)
select results_eq(
  $$select allowed, reason
    from public.login_code_issue(repeat('e', 64), repeat('e0', 32), null, repeat('c1', 32), 'organisateur.e@example.com')$$,
  $$values (true, 'ok')$$,
  'adresse e : code émis'
);

reset role;
update public.login_attempts set failed_count = 4 where identifier_hash = repeat('e', 64);
set local role service_role;

select results_eq(
  $$select result
    from public.login_code_verify(repeat('e', 64), repeat('e0', 32), null, repeat('c9', 32), 'organisateur.e@example.com')$$,
  $$values ('locked')$$,
  '5e échec avec un code actif : locked'
);

reset role;
select is((select code_hmac from public.login_attempts where identifier_hash = repeat('e', 64)), null::text,
  'blocage : le code actif est effacé (plus aucune chance de le deviner)');
update public.login_attempts
  set locked_until = now() - interval '1 second'
  where identifier_hash = repeat('e', 64);
set local role service_role;

select results_eq(
  $$select result
    from public.login_code_verify(repeat('e', 64), repeat('e0', 32), null, repeat('c1', 32), 'organisateur.e@example.com')$$,
  $$values ('wrong')$$,
  'après le blocage, l''ancien code juste ne vaut plus rien'
);

-- Code juste au 5e essai : compteur remis à zéro ----------------------------- (3)
select results_eq(
  $$select allowed, reason
    from public.login_code_issue(repeat('f', 64), repeat('f0', 32), null, repeat('c1', 32), 'organisateur.f@example.com')$$,
  $$values (true, 'ok')$$,
  'adresse f : code émis'
);

reset role;
update public.login_attempts set failed_count = 4 where identifier_hash = repeat('f', 64);
set local role service_role;

select results_eq(
  $$select result
    from public.login_code_verify(repeat('f', 64), repeat('f0', 32), null, repeat('c1', 32), 'organisateur.f@example.com')$$,
  $$values ('ok')$$,
  'code juste après 4 échecs : ok (pas de blocage)'
);

reset role;
select is((select failed_count from public.login_attempts where identifier_hash = repeat('f', 64)), 0::smallint,
  'code juste : échecs remis à zéro (D52)');

-- Génération absente de la base, empreinte seule ---------------------------- (3)
select is(
  array(
    select p.oid::regprocedure::text
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where (n.nspname = 'public' and p.proname in ('login_code_issue', 'login_code_verify'))
       or (n.nspname = 'private' and p.proname like 'login\_%')
    group by p.oid
    -- Appels de fonctions de tirage ou de hachage (« code_hmac » n'est pas un appel).
    having bool_or(p.prosrc ~* '\m(random|gen_random_bytes|gen_random_uuid|hmac|digest|crypt|gen_salt|encode)\s*\(')
    order by 1
  ),
  array[]::text[],
  'aucune fonction de connexion ne tire un code ni ne calcule d''empreinte (tout est fait dans Node)'
);
select throws_ok(
  $$update public.login_attempts
      set code_hmac = '123456', code_expires_at = now() + interval '10 minutes'
      where identifier_hash = repeat('f', 64)$$,
  '23514', null, 'contrainte : un code en clair ne peut pas être stocké (empreinte hexadécimale de 64 caractères seulement)');
select throws_ok(
  $$update public.login_attempts
      set code_hmac = repeat('c1', 32), code_expires_at = null
      where identifier_hash = repeat('f', 64)$$,
  '23514', null, 'contrainte : une empreinte de code a toujours une date d''expiration');

-- Verrous (concurrence) : chaque ligne est verrouillée avant la décision,
-- toujours dans le même ordre (IP → global → adresse) ----------------------- (5)
select ok(
  (select p.prosrc ~* 'for update' from pg_catalog.pg_proc p
   where p.oid = 'private.login_attempt_lock_row(text)'::regprocedure),
  'ligne de l''adresse verrouillée (FOR UPDATE)');
select ok(
  (select p.prosrc ~* 'for update' from pg_catalog.pg_proc p
   where p.oid = 'private.login_ip_window(text,text,text)'::regprocedure),
  'lignes d''IP verrouillées (FOR UPDATE)');
select ok(
  (select p.prosrc ~* 'for update' from pg_catalog.pg_proc p
   where p.oid = 'private.login_code_global_window()'::regprocedure),
  'ligne du plafond global verrouillée (FOR UPDATE)');
select ok(
  (select strpos(p.prosrc, 'private.login_ip_gate(') > 0
          and strpos(p.prosrc, 'private.login_ip_gate(') < strpos(p.prosrc, 'private.login_code_global_window(')
          and strpos(p.prosrc, 'private.login_code_global_window(') < strpos(p.prosrc, 'private.login_attempt_lock_row(')
   from pg_catalog.pg_proc p
   where p.oid = 'public.login_code_issue(text,text,text,text,text)'::regprocedure),
  'login_code_issue : verrous dans l''ordre IP → global → adresse (pas d''interblocage)');
select ok(
  (select strpos(p.prosrc, 'private.login_ip_gate(') > 0
          and strpos(p.prosrc, 'private.login_ip_gate(') < strpos(p.prosrc, 'private.login_attempt_lock_row(')
          and strpos(p.prosrc, 'login_code_global') = 0
   from pg_catalog.pg_proc p
   where p.oid = 'public.login_code_verify(text,text,text,text,text)'::regprocedure),
  'login_code_verify : verrous dans l''ordre IP → adresse, sans le compteur global');

-- Purge (pg_cron, 48 h) ----------------------------------------------------- (3)
insert into public.login_attempts (identifier_hash, updated_at)
  values (repeat('9', 64), now() - interval '49 hours');
insert into public.login_attempts (identifier_hash, failed_count, locked_until, updated_at)
  values (repeat('8', 64), 5, now() + interval '5 minutes', now() - interval '49 hours');
select cmp_ok(private.purge_login_attempts(), '>=', 1, 'purge : lancée sans erreur, au moins une ligne supprimée');

select is((select count(*)::integer from public.login_attempts where identifier_hash = repeat('9', 64)), 0,
  'purge : une ligne inactive depuis plus de 48 h est supprimée');
select is((select count(*)::integer from public.login_attempts where identifier_hash = repeat('8', 64)), 1,
  'purge : une ligne encore bloquée est conservée');

select * from finish();
rollback;
