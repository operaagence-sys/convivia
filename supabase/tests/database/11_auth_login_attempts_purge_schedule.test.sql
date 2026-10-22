-- Tranche 2 — connexion : purge horaire de login_attempts planifiée par
-- pg_cron (migration 20261021150300).
-- Sources : docs/07 § 2.1 (« purge des lignes inactives depuis plus de
-- 48 h ») ; docs/06 § 1.2.
begin;
create extension if not exists pgtap with schema extensions;

select plan(3);

select has_extension('pg_cron', 'extension pg_cron active');
select results_eq(
  $$select schedule, command, active
    from cron.job
    where jobname = 'purge-login-attempts'$$,
  $$values ('17 * * * *'::text, 'select private.purge_login_attempts()'::text, true)$$,
  'tâche purge-login-attempts : chaque heure, appelle private.purge_login_attempts()'
);
select is(
  (select count(*)::integer from cron.job where jobname = 'purge-login-attempts'),
  1,
  'une seule tâche purge-login-attempts (migration rejouable sans doublon)'
);

select * from finish();
rollback;
