-- Tranche 2 — connexion (4/4) : purge horaire de login_attempts par pg_cron.
-- Sources : docs/07-schema-backend.md § 2.1 (« purge des lignes inactives
-- depuis plus de 48 h ») ; docs/06-trd.md § 1.2 (pg_cron) ;
-- docs/09-conventions.md § 2.
--
-- pg_cron n'était PAS activé sur le staging au 2026-10-21 (list_extensions).
-- Cette migration l'active elle-même (forme documentée par Supabase,
-- https://supabase.com/docs/guides/cron/install), pour que la base éphémère
-- de la CI, qui rejoue les migrations, ait le même état que le staging. Si
-- le porteur du projet active l'extension depuis le tableau de bord avant le
-- db push, « if not exists » rend l'instruction sans effet.
--
-- La tâche s'exécute en tant que postgres (propriétaire de
-- private.purge_login_attempts) ; aucun droit n'est accordé aux rôles de
-- l'API. cron.schedule avec un nom remplace la tâche du même nom : la
-- migration peut être rejouée sans doublon.

create extension if not exists pg_cron with schema pg_catalog;

grant usage on schema cron to postgres;

select cron.schedule(
  'purge-login-attempts',
  '17 * * * *',
  $$select private.purge_login_attempts()$$
);
