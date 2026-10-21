-- Tranche 1 — socle : lecture publique explicite des pays et des paliers de prix.
-- Décision du porteur du projet (C4) : anon ne lit que les pays actifs et les
-- paliers de prix actifs. Les lignes sont filtrées par les politiques RLS
-- countries_select_active_anon et pricing_tiers_select_active_anon
-- (USING (is_active)) ; ce GRANT ne fait que rendre explicite le SELECT,
-- sans dépendre des privilèges par défaut du schéma public.
-- Rien d'autre n'est accordé (pas d'INSERT / UPDATE / DELETE).

-- rls-check: anon-read choix de l'indicatif pays (connexion, ajout d'invité) ; lignes filtrées par RLS sur is_active
grant select on table public.countries to anon, authenticated;

-- rls-check: anon-read grille de prix de la vitrine et de l'écran forfait ; lignes filtrées par RLS sur is_active
grant select on table public.pricing_tiers to anon, authenticated;
