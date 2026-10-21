-- Tranche 1 — socle : pricing_tiers.total_price obligatoire.
-- Décision du porteur du projet (2026-10-21). Sources : docs/07-schema-backend.md
-- § 8.1 ; docs/01-prd.md § 7.1.
--
-- total_price est une colonne générée stockée (seats × unit_price), toujours
-- remplie puisque seats et unit_price sont NOT NULL. Le NOT NULL rend la règle
-- explicite dans le schéma et donne un type `number` (et non `number | null`)
-- dans les types TypeScript générés. Aucune ligne n'est modifiée (les
-- déclencheurs de pricing_tiers ne sont pas sollicités).

alter table public.pricing_tiers
  alter column total_price set not null;
