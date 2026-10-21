-- Tranche 1 — socle : durcissement des privilèges par défaut.
-- Décision du porteur du projet (2026-10-21). Sources : docs/06-trd.md § 1.3 ;
-- docs/07-schema-backend.md § 1.1 (refus par défaut) ; CLAUDE.md § 5.
--
-- Avant cette migration, toute table, séquence ou fonction créée par `postgres`
-- (le rôle qui applique nos migrations) dans le schéma public recevait
-- automatiquement TOUS les droits pour anon et authenticated (privilèges par
-- défaut de la plateforme), et toute fonction créée par `postgres`, quel que
-- soit le schéma, était exécutable par PUBLIC (défaut de Postgres). Seules la
-- RLS et nos REVOKE explicites fermaient l'accès : un oubli ouvrait tout.
--
-- DÉSORMAIS (objets créés APRÈS cette migration) :
-- - tables, vues, séquences et fonctions créées par `postgres` dans public :
--   AUCUN droit pour anon ni authenticated ;
-- - fonctions créées par `postgres` dans N'IMPORTE QUEL schéma (public,
--   private…) : plus d'EXECUTE pour PUBLIC. Ce retrait est global (sans
--   IN SCHEMA) car Postgres ne permet pas de retirer, schéma par schéma, un
--   droit accordé par le défaut global ;
-- - service_role : inchangé (garde ses privilèges par défaut sur public) ;
-- - objets existants : inchangés (un privilège par défaut ne s'applique qu'aux
--   objets créés ensuite). Les SELECT voulus d'anon / authenticated sur
--   countries et pricing_tiers sont accordés explicitement (migration
--   20261021140500) et restent en place.
--
-- RÈGLE POUR LES MIGRATIONS SUIVANTES : chaque nouvelle table (ou vue,
-- séquence) doit accorder EXPLICITEMENT ses droits, au strict nécessaire
-- (GRANT SELECT / INSERT / UPDATE (colonnes…) TO authenticated…, en plus de
-- ses politiques RLS), et chaque fonction appelable par un client (RPC, aide
-- RLS de private) doit recevoir un GRANT EXECUTE explicite au rôle voulu.
-- Une fonction de déclencheur n'a besoin d'aucun GRANT (EXECUTE n'est pas
-- vérifié au déclenchement).
--
-- Limite connue : les privilèges par défaut du rôle `supabase_admin` (objets
-- créés par la plateforme dans public, par exemple une extension installée
-- dans public) ne peuvent pas être modifiés : `postgres` n'est ni
-- superutilisateur ni membre de `supabase_admin` (« permission denied to
-- change default privileges », vérifié sur le staging le 2026-10-21). Les
-- extensions vont donc dans le schéma `extensions`, jamais dans public.
-- Le schéma storage garde aussi ses privilèges par défaut de la plateforme
-- (hors périmètre de cette migration ; à revoir avec les buckets).

alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;

alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;

alter default privileges for role postgres in schema public
  revoke all on functions from anon, authenticated;

alter default privileges for role postgres
  revoke execute on functions from public;
