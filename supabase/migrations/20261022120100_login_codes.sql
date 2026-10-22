-- Tranche 2 — refonte de la connexion (2/2) : Convivia fabrique et vérifie
-- lui-même le code de connexion ; la base tient l'empreinte du code et tous
-- les compteurs, sous verrou, dans deux fonctions atomiques.
-- Sources : décision du porteur du projet du 2026-10-22 ; revue de conception
-- du security-reviewer (changements obligatoires 1 à 3) et décisions R3 du
-- porteur du projet (plafond global 300 / h avec alerte, variantes d'une même
-- boîte comptées ensemble, limite IPv6 par /48) ; docs/06-trd.md § 7.1, D23,
-- D24, D47, D52, D56 ; docs/07-schema-backend.md § 1.2 (règles 1, 4, 8),
-- § 2.1, § 2.5, § 13, § 17 ; docs/09-conventions.md § 2, § 20 quater.
--
-- RÈGLES (inchangées, TRD D47–D58) : code à 6 chiffres valable 10 min ; un
-- nouvel envoi au plus toutes les 60 s ; 3 codes au plus par heure glissante
-- et par adresse ; 5 codes faux → 15 min sans envoi NI vérification pour
-- cette adresse ; compteur remis à zéro par un code juste ; message neutre
-- (D23) ; admins exclus ; limites par IP. Toutes les valeurs vivent dans
-- private.login_code_settings() et private.login_ip_limits() (un seul
-- endroit, à changer par une nouvelle migration avec les contraintes de
-- login_attempts qui les reprennent : 3 envois, 5 échecs).
--
-- CE QUI ENTRE DANS LA BASE (jamais d'e-mail, d'IP ni de code en clair dans
-- une table) :
-- - p_identifier_hash : empreinte DE QUOTA de l'adresse (HMAC-SHA256 avec
--   LOGIN_ATTEMPTS_HASH_SECRET de l'adresse normalisée pour les quotas,
--   calculée dans Node) : les variantes d'une même boîte (« +tag », points
--   Gmail) ont la même empreinte et partagent donc 60 s, 3 / h et les
--   5 échecs ;
-- - p_ip_hash / p_ip48_hash : empreintes HMAC (LOGIN_IP_HASH_SECRET) de
--   l'IPv4 ou du préfixe IPv6 /64, et du préfixe IPv6 /48 (nul en IPv4) ;
-- - p_code_hmac : HMAC-SHA256(LOGIN_CODE_PEPPER, « login-code:v1: » ‖
--   p_identifier_hash ‖ « : » ‖ code ‖ « : » ‖ e-mail exact), en hexadécimal
--   minuscule. Le code est TIRÉ DANS NODE (crypto.randomInt) : aucune
--   fonction de la base ne fabrique ni ne voit un code. L'e-mail exact dans
--   l'empreinte lie le code AU COMPTE demandé : un code demandé pour
--   « a+x@… » ne vaut pas pour « a+y@… » (comptes distincts), même si les
--   deux partagent les quotas ;
-- - p_email : l'e-mail exact (minuscules, sans espaces de bord), reçu en
--   PARAMÈTRE seulement, jamais écrit : il sert à décider DANS LA BASE si
--   l'adresse est celle d'un admin (voir ci-dessous).
--
-- ADMINS (changement obligatoire 3) — choix : la base décide elle-même, à
-- partir de p_email (public.auth_email_is_admin), plutôt qu'un paramètre
-- p_store fourni par la route. Justification : l'empreinte ne permet pas de
-- retrouver l'adresse (le secret HMAC n'est pas dans la base), et la règle
-- « un admin ne se connecte jamais par code » doit vivre dans Postgres
-- (CLAUDE.md § 5) : un oubli ou un bogue de la route ne peut pas la lever.
-- - login_code_issue applique à un admin EXACTEMENT les mêmes quotas et la
--   même réponse (allowed, reason, retry_at), remplace le code précédent par
--   RIEN (aucune empreinte de code stockée) et renvoie deliver = false : la
--   route n'envoie aucun e-mail mais répond comme pour un succès (envoi dans
--   after(), temps de réponse indépendant de l'envoi) ;
-- - login_code_verify ne renvoie JAMAIS « ok » pour une adresse admin, même
--   si une empreinte correspondante existait : l'échec est compté comme un
--   code faux (réponse « wrong », identique).
--
-- ATOMICITÉ ET VERROUS (changement obligatoire 2) : chaque appel est une
-- transaction ; les lignes sont verrouillées (INSERT … ON CONFLICT DO
-- NOTHING puis SELECT … FOR UPDATE) TOUJOURS dans le même ordre, ce qui
-- exclut l'interblocage : IP (/64) → IP (/48) → compteur global (issue
-- seulement) → adresse. Contrôle, décision et écriture dans la même
-- transaction : deux demandes ou deux vérifications simultanées sont
-- sérialisées, aucun plafond ne peut être dépassé.
--
-- login_code_issue : limites IP (/64 puis /48) → plafond global (300 codes
-- par heure glissante pour toute la plateforme) → blocage (5 échecs) →
-- 3 / h → 60 s → le nouveau code REMPLACE le précédent (un seul code actif
-- par adresse de quota), valable 10 min.
-- - Une demande admise par l'IP compte pour l'IP même si elle est refusée
--   ensuite (sonder coûte) ; une demande refusée par l'IP n'est pas comptée.
-- - Le plafond global ne compte que les codes émis. Quand il est atteint,
--   refus neutre pour tous (« global_cap ») et, au plus une fois par heure,
--   un événement fixe « auth.login_code_global_cap_reached » dans audit_log
--   (acteur system, sans donnée personnelle) ; l'alerte réelle (Sentry,
--   administration) lira ce journal.
-- login_code_verify : limites IP → blocage → comparaison de l'empreinte →
-- AU MÊME MOMENT, soit consommation (usage unique : le code est effacé) et
-- remise à zéro du compteur d'échecs, soit échec + 1 (5 → blocage de
-- 15 min, code effacé). L'échec est compté MÊME sans code actif et sans
-- compte (D23 : rien ne distingue une adresse inconnue).
--
-- NETTOYAGE de l'ancien parcours (fichiers 20261022100000 à 20261022100300,
-- jamais appliqués, supprimés du dépôt le 2026-10-22 ; « if exists » rend
-- cette migration valable qu'ils aient été appliqués ou non) :
-- login_attempt_before_send / before_verify / reset / status, tickets d'envoi
-- et de vérification (tables et fonctions), ancienne table login_ip_attempts
-- (recréée ici avec la portée /64 ou /48).
--
-- Accès : toutes les tables sont fermées à anon, authenticated et
-- service_role (aucune politique, aucun droit de table) ; seules les deux
-- fonctions publiques (SECURITY DEFINER, EXECUTE service_role seulement) les
-- lisent et les écrivent. Purge horaire existante (pg_cron,
-- « purge-login-attempts ») étendue.
--
-- Écarts avec 07 (reportés dans 07 § 2.1 et § 13 par cette tranche) :
-- colonnes code_hmac / code_expires_at de login_attempts ; login_ip_attempts
-- avec ip_scope ; nouvelle table login_code_global_counter.

-- ---------------------------------------------------------------------------
-- 0. Retrait de l'ancien parcours (tickets, fonctions before_* / reset /
--    status). Fonctions d'abord (leurs corps citent les tables), tables
--    ensuite.
-- ---------------------------------------------------------------------------
drop function if exists public.login_verify_ticket_revoke(uuid);
drop function if exists public.login_verify_ticket_issue(text, text);
drop function if exists public.login_send_ticket_consume(text, text);
drop function if exists public.login_attempt_before_send(text, text);
drop function if exists public.login_attempt_before_verify(text, text);
drop function if exists public.login_attempt_before_send(text);
drop function if exists public.login_attempt_before_verify(text);
drop function if exists public.login_attempt_reset(text);
drop function if exists public.login_attempt_status(text);
drop function if exists private.login_ip_attempt_check(text, text);
drop function if exists private.login_ip_limits(text);
drop function if exists private.login_send_ticket_ttl();
drop function if exists private.login_verify_ticket_ttl();

drop table if exists public.login_verify_tickets;
drop table if exists public.login_send_tickets;
drop table if exists public.login_ip_attempts;

-- ---------------------------------------------------------------------------
-- 1. Réglages (un seul endroit)
-- ---------------------------------------------------------------------------
create function private.login_code_settings()
returns table (
  code_ttl interval,
  resend_interval interval,
  hourly_window interval,
  hourly_max integer,
  max_failures integer,
  lock_duration interval,
  global_window interval,
  global_max integer
)
language sql
immutable
set search_path = ''
as $$
  select interval '10 minutes',
         interval '60 seconds',
         interval '1 hour',
         3,
         5,
         interval '15 minutes',
         interval '1 hour',
         300
$$;

comment on function private.login_code_settings() is
  'Interne : règles des codes de connexion — code valable 10 min, renvoi après 60 s, 3 codes par heure glissante et par adresse de quota, 5 échecs → blocage 15 min (D52), plafond global 300 codes par heure glissante (décision du 2026-10-22). Les contraintes de login_attempts reprennent 3 et 5.';

revoke all on function private.login_code_settings() from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. login_attempts : empreinte du code actif (table existante, 07 § 2.1)
-- ---------------------------------------------------------------------------
alter table public.login_attempts
  add column code_hmac text,
  add column code_expires_at timestamptz,
  add constraint login_attempts_code_hmac_format
    check (code_hmac is null or code_hmac ~ '^[0-9a-f]{64}$'),
  add constraint login_attempts_code_consistency
    check ((code_hmac is null) = (code_expires_at is null));

comment on table public.login_attempts is
  'Une ligne par adresse de QUOTA (empreinte HMAC ; variantes « +tag » et points Gmail regroupées) : empreinte du code actif, échecs, blocage, envois de l''heure. Aucun e-mail ni code en clair. Aucun droit pour anon, authenticated ni service_role : accès par login_code_issue / login_code_verify seulement ; purge à 48 h d''inactivité (docs/07 § 2.1 ; docs/06 D24, D52 ; décision du 2026-10-22).';
comment on column public.login_attempts.identifier_hash is
  'HMAC-SHA256(LOGIN_ATTEMPTS_HASH_SECRET, adresse normalisée pour les quotas : minuscules, sans espaces de bord, partie locale sans « +tag », sans points pour gmail.com / googlemail.com, domaine googlemail.com → gmail.com), hexadécimal minuscule, calculé par Node.';
comment on column public.login_attempts.failed_count is
  'Codes faux (ou vérifications sans code actif) depuis le dernier code juste ou la fin du dernier blocage (0 à 5). La 5e pose le blocage ; remis à 0 par un code juste, dans la même transaction que sa consommation.';
comment on column public.login_attempts.locked_until is
  'Fin du blocage de 15 min posé au 5e échec. Pendant le blocage : ni envoi ni vérification (D52) ; le code actif est effacé au moment du blocage.';
comment on column public.login_attempts.send_times is
  'Dates des codes émis dans l''heure glissante (3 au plus, D52), admins compris (même comportement).';
comment on column public.login_attempts.code_hmac is
  'Empreinte du code actif : HMAC-SHA256(LOGIN_CODE_PEPPER, « login-code:v1: » ‖ identifier_hash ‖ « : » ‖ code ‖ « : » ‖ e-mail exact), calculée par Node. Nulle : aucun code utilisable (jamais émis, consommé, expiré et nettoyé, effacé au blocage, ou adresse admin). Le code en clair n''entre jamais dans la base.';
comment on column public.login_attempts.code_expires_at is
  'Fin de validité du code actif (émission + 10 min) ; nulle si code_hmac est nul.';

-- ---------------------------------------------------------------------------
-- 3. login_ip_attempts : limite par IP (/64 ou IPv4) et par préfixe IPv6 /48
-- ---------------------------------------------------------------------------
create table public.login_ip_attempts (
  ip_hash text not null,
  ip_scope text not null,
  action text not null,
  attempt_times timestamptz[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint login_ip_attempts_pkey primary key (ip_hash, ip_scope, action),
  constraint login_ip_attempts_ip_hash_format check (ip_hash ~ '^[0-9a-f]{64}$'),
  constraint login_ip_attempts_ip_scope_check check (ip_scope in ('addr', 'v6_48')),
  constraint login_ip_attempts_action_check check (action in ('send_code', 'verify_code')),
  -- Borne de sécurité indépendante des seuils (au plus 400 dates gardées :
  -- long_max le plus grand, verify_code par /48).
  constraint login_ip_attempts_attempt_times_bounded check (
    cardinality(attempt_times) <= 450 and array_position(attempt_times, null) is null
  )
);

comment on table public.login_ip_attempts is
  'Limite par IP des demandes et des vérifications de code, indexée par empreinte HMAC (aucune IP en clair) : portée addr (IPv4, ou préfixe IPv6 /64) et portée v6_48 (préfixe IPv6 /48). Aucun droit pour anon, authenticated ni service_role : accès par login_code_issue / login_code_verify seulement ; purge à 48 h d''inactivité (audit sécurité tranche 2 ; décision R3 du 2026-10-22).';
comment on column public.login_ip_attempts.ip_hash is
  'HMAC-SHA256(LOGIN_IP_HASH_SECRET, IP normalisée : « a.b.c.d », « h0:h1:h2:h3::/64 », « h0:h1:h2::/48 » ou « unknown »), hexadécimal minuscule, calculé par Node.';
comment on column public.login_ip_attempts.ip_scope is
  'addr : IPv4 ou préfixe IPv6 /64 (ou « unknown ») ; v6_48 : préfixe IPv6 /48 (seuils plus larges, private.login_ip_limits).';
comment on column public.login_ip_attempts.action is
  'send_code (login_code_issue) ou verify_code (login_code_verify).';
comment on column public.login_ip_attempts.attempt_times is
  'Dates des demandes admises sur les dernières 24 h, de la plus ancienne à la plus récente (fenêtres glissantes de 10 min et 24 h).';

create index login_ip_attempts_updated_at_idx on public.login_ip_attempts (updated_at);

create trigger login_ip_attempts_set_updated_at
  before update on public.login_ip_attempts
  for each row execute function private.set_updated_at();

alter table public.login_ip_attempts enable row level security;

revoke all on table public.login_ip_attempts from anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. login_code_global_counter : plafond global (une seule ligne)
-- ---------------------------------------------------------------------------
create table public.login_code_global_counter (
  id boolean primary key default true,
  issue_times timestamptz[] not null default '{}',
  cap_alerted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint login_code_global_counter_singleton check (id),
  constraint login_code_global_counter_issue_times_bounded check (
    cardinality(issue_times) <= 300 and array_position(issue_times, null) is null
  )
);

comment on table public.login_code_global_counter is
  'Plafond global des codes de connexion (300 par heure glissante, toute la plateforme ; décision R3 du 2026-10-22). Une seule ligne, verrouillée par login_code_issue. Aucune donnée personnelle. Aucun droit pour anon, authenticated ni service_role.';
comment on column public.login_code_global_counter.issue_times is
  'Dates des codes émis dans l''heure glissante, de la plus ancienne à la plus récente (300 au plus).';
comment on column public.login_code_global_counter.cap_alerted_at is
  'Dernière inscription de « auth.login_code_global_cap_reached » dans audit_log (au plus une par heure).';

create trigger login_code_global_counter_set_updated_at
  before update on public.login_code_global_counter
  for each row execute function private.set_updated_at();

alter table public.login_code_global_counter enable row level security;

revoke all on table public.login_code_global_counter from anon, authenticated, service_role;

insert into public.login_code_global_counter (id) values (true)
  on conflict on constraint login_code_global_counter_pkey do nothing;

-- ---------------------------------------------------------------------------
-- 5. Seuils par IP (un seul endroit)
-- ---------------------------------------------------------------------------
-- addr (IPv4 ou /64) : validés par le porteur du projet (2026-10-22).
-- v6_48 : validés par le porteur du projet (2026-10-22, « plus souples ») :
-- six fois les seuils par /64 sur 10 min et un peu moins de sept fois sur
-- 24 h. Un /48 couvre 65 536 /64 ; il correspond en général à un site
-- (entreprise, université, box d'un abonné) mais un opérateur mobile peut y
-- placer plusieurs abonnés. Une source qui dispose d'un /48 entier n'obtient
-- plus 65 536 × 30 codes par jour, mais 200 ; elle ne bloque plus que
-- 80 adresses par jour (400 ÷ 5).
create function private.login_ip_limits(p_scope text, p_action text)
returns table (short_window interval, short_max integer, long_window interval, long_max integer)
language plpgsql
immutable
set search_path = ''
as $$
begin
  case
    when p_scope = 'addr' and p_action = 'send_code' then
      return query select interval '10 minutes', 10, interval '24 hours', 30;
    when p_scope = 'addr' and p_action = 'verify_code' then
      return query select interval '10 minutes', 20, interval '24 hours', 60;
    when p_scope = 'v6_48' and p_action = 'send_code' then
      return query select interval '10 minutes', 60, interval '24 hours', 200;
    when p_scope = 'v6_48' and p_action = 'verify_code' then
      return query select interval '10 minutes', 120, interval '24 hours', 400;
    else
      raise exception 'invalid login ip scope % or action %', p_scope, p_action using errcode = '22023';
  end case;
end;
$$;

comment on function private.login_ip_limits(text, text) is
  'Interne : seuils par IP. addr (IPv4 ou /64) : send_code 10 / 10 min et 30 / 24 h, verify_code 20 / 10 min et 60 / 24 h (validés) ; v6_48 (/48) : send_code 60 / 10 min et 200 / 24 h, verify_code 120 / 10 min et 400 / 24 h (validés le 2026-10-22).';

revoke all on function private.login_ip_limits(text, text) from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 6. Aides internes : verrous et fenêtres (aucune écriture de décision)
-- ---------------------------------------------------------------------------
-- Crée la ligne (ip_hash, scope, action) si besoin, la VERROUILLE, renvoie
-- les dates des dernières 24 h et, si une limite est atteinte, la date de la
-- prochaine demande admise (la plus tardive des deux fenêtres dépassées).
create function private.login_ip_window(p_ip_hash text, p_scope text, p_action text)
returns table (kept timestamptz[], retry_at timestamptz)
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_now timestamptz := now();
  v_limits record;
  v_times timestamptz[];
  v_long timestamptz[];
  v_short timestamptz[];
  v_retry timestamptz;
begin
  select l.short_window, l.short_max, l.long_window, l.long_max
    into v_limits
    from private.login_ip_limits(p_scope, p_action) as l;

  insert into public.login_ip_attempts (ip_hash, ip_scope, action)
    values (p_ip_hash, p_scope, p_action)
    on conflict on constraint login_ip_attempts_pkey do nothing;

  select a.attempt_times into v_times
    from public.login_ip_attempts a
    where a.ip_hash = p_ip_hash and a.ip_scope = p_scope and a.action = p_action
    for update;

  v_long := array(
    select s.t from unnest(v_times) as s(t)
    where s.t > v_now - v_limits.long_window
    order by s.t
  );
  v_short := array(
    select s.t from unnest(v_long) as s(t)
    where s.t > v_now - v_limits.short_window
    order by s.t
  );

  if cardinality(v_short) >= v_limits.short_max then
    v_retry := v_short[cardinality(v_short) - v_limits.short_max + 1] + v_limits.short_window;
  end if;
  if cardinality(v_long) >= v_limits.long_max then
    -- greatest() ignore une valeur nulle.
    v_retry := greatest(v_retry, v_long[cardinality(v_long) - v_limits.long_max + 1] + v_limits.long_window);
  end if;

  return query select v_long, v_retry;
end;
$$;

comment on function private.login_ip_window(text, text, text) is
  'Interne : verrouille (FOR UPDATE) la ligne de login_ip_attempts de cette empreinte, portée et action (créée si besoin) ; renvoie les dates des dernières 24 h et la date de la prochaine demande admise si une limite est atteinte (nulle sinon). N''enregistre rien.';

revoke all on function private.login_ip_window(text, text, text) from public, anon, authenticated, service_role;

-- Limite par IP complète : /64 (ou IPv4) puis /48 (IPv6 seulement), dans cet
-- ordre. Si les deux admettent la demande, elle est enregistrée dans les
-- deux ; sinon rien n'est ajouté (dates anciennes retirées seulement).
create function private.login_ip_gate(p_ip_hash text, p_ip48_hash text, p_action text)
returns table (allowed boolean, retry_at timestamptz)
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_now timestamptz := now();
  v_addr_times timestamptz[];
  v_addr_retry timestamptz;
  v_48_times timestamptz[];
  v_48_retry timestamptz;
  v_retry timestamptz;
begin
  if p_ip_hash is null or p_ip_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid ip_hash (expected 64 lowercase hex characters)' using errcode = '22023';
  end if;
  if p_ip48_hash is not null and p_ip48_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid ip48_hash (expected null or 64 lowercase hex characters)' using errcode = '22023';
  end if;

  select w.kept, w.retry_at into v_addr_times, v_addr_retry
    from private.login_ip_window(p_ip_hash, 'addr', p_action) as w;
  if p_ip48_hash is not null then
    select w.kept, w.retry_at into v_48_times, v_48_retry
      from private.login_ip_window(p_ip48_hash, 'v6_48', p_action) as w;
  end if;

  v_retry := greatest(v_addr_retry, v_48_retry);

  update public.login_ip_attempts a
    set attempt_times = case when v_retry is null then v_addr_times || v_now else v_addr_times end
    where a.ip_hash = p_ip_hash and a.ip_scope = 'addr' and a.action = p_action;
  if p_ip48_hash is not null then
    update public.login_ip_attempts a
      set attempt_times = case when v_retry is null then v_48_times || v_now else v_48_times end
      where a.ip_hash = p_ip48_hash and a.ip_scope = 'v6_48' and a.action = p_action;
  end if;

  return query select v_retry is null, v_retry;
end;
$$;

comment on function private.login_ip_gate(text, text, text) is
  'Interne : limite par IP sous verrou, /64 (ou IPv4) puis /48 ; enregistre la demande dans les deux portées si les deux l''admettent, sinon n''enregistre rien. Renvoie allowed, retry_at (prochaine demande admise).';

revoke all on function private.login_ip_gate(text, text, text) from public, anon, authenticated, service_role;

-- Verrouille la ligne unique du plafond global et renvoie les dates de
-- l'heure glissante et la date de la dernière alerte.
create function private.login_code_global_window()
returns table (kept timestamptz[], alerted_at timestamptz)
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_now timestamptz := now();
  v_window interval;
  v_times timestamptz[];
  v_alerted timestamptz;
begin
  select s.global_window into v_window from private.login_code_settings() as s;

  insert into public.login_code_global_counter (id) values (true)
    on conflict on constraint login_code_global_counter_pkey do nothing;

  select g.issue_times, g.cap_alerted_at into v_times, v_alerted
    from public.login_code_global_counter g
    where g.id
    for update;

  return query select
    array(select s.t from unnest(v_times) as s(t) where s.t > v_now - v_window order by s.t),
    v_alerted;
end;
$$;

comment on function private.login_code_global_window() is
  'Interne : verrouille (FOR UPDATE) la ligne unique de login_code_global_counter ; renvoie les codes émis dans l''heure glissante et la date de la dernière alerte. N''enregistre rien.';

revoke all on function private.login_code_global_window() from public, anon, authenticated, service_role;

-- Contrôle des arguments communs (erreur 22023 = bogue de la route, jamais
-- montrée au client).
create function private.login_code_check_args(p_identifier_hash text, p_code_hmac text, p_email text)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_identifier_hash is null or p_identifier_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid identifier_hash (expected 64 lowercase hex characters)' using errcode = '22023';
  end if;
  if p_code_hmac is null or p_code_hmac !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid code_hmac (expected 64 lowercase hex characters)' using errcode = '22023';
  end if;
  if p_email is null
     or p_email <> lower(btrim(p_email))
     or char_length(p_email) > 254
     or p_email !~ '^[^@[:space:][:cntrl:]]+@[^@[:space:][:cntrl:]]+\.[^@[:space:][:cntrl:]]+$' then
    raise exception 'invalid email (expected the exact address, lowercase, trimmed)' using errcode = '22023';
  end if;
end;
$$;

comment on function private.login_code_check_args(text, text, text) is
  'Interne : refuse (22023) une empreinte d''adresse ou de code qui n''est pas en hexadécimal minuscule de 64 caractères, ou un e-mail non normalisé (minuscules, sans espaces de bord, 254 caractères au plus).';

revoke all on function private.login_code_check_args(text, text, text) from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 7. login_code_issue — demande de code (route /login et renvoi)
-- ---------------------------------------------------------------------------
-- reason : 'ok' | 'ip_limited' | 'global_cap' | 'locked' | 'hourly_cap'
--        | 'too_soon'.
-- retry_at : date à partir de laquelle une nouvelle demande sera admise
--   (refus) ; pour 'ok', date du prochain renvoi possible (60 s, ou sortie du
--   plus ancien code de l'heure si c'était le 3e).
-- deliver : true seulement si un code utilisable a été enregistré (ok et
--   adresse non admin) : la route envoie alors l'e-mail ; false : AUCUN
--   e-mail, mais la même réponse au client.
create function public.login_code_issue(
  p_identifier_hash text,
  p_ip_hash text,
  p_ip48_hash text,
  p_code_hmac text,
  p_email text
)
returns table (allowed boolean, reason text, retry_at timestamptz, deliver boolean)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := now();
  v_cfg record;
  v_ip_allowed boolean;
  v_ip_retry timestamptz;
  v_global timestamptz[];
  v_alerted timestamptz;
  v_row public.login_attempts;
  v_sends timestamptz[];
  v_count integer;
  v_is_admin boolean;
  v_next timestamptz;
begin
  perform private.login_code_check_args(p_identifier_hash, p_code_hmac, p_email);
  select s.* into v_cfg from private.login_code_settings() as s;

  -- 1. Limite par IP (/64 puis /48), en premier.
  select g.allowed, g.retry_at into v_ip_allowed, v_ip_retry
    from private.login_ip_gate(p_ip_hash, p_ip48_hash, 'send_code') as g;
  -- « is not true » : aucune ligne renvoyée = refus (échec fermé).
  if v_ip_allowed is not true then
    return query select false, 'ip_limited'::text, v_ip_retry, false;
    return;
  end if;

  -- 2. Plafond global (verrou de la ligne unique).
  select w.kept, w.alerted_at into v_global, v_alerted
    from private.login_code_global_window() as w;

  if cardinality(v_global) >= v_cfg.global_max then
    -- Événement fixe pour l'alerte, au plus une fois par heure.
    if v_alerted is null or v_alerted <= v_now - v_cfg.global_window then
      insert into public.audit_log (actor_kind, action, details)
        values ('system', 'auth.login_code_global_cap_reached',
                jsonb_build_object('limit', v_cfg.global_max, 'window_minutes', 60));
      v_alerted := v_now;
    end if;
    update public.login_code_global_counter g
      set issue_times = v_global, cap_alerted_at = v_alerted
      where g.id;
    return query select false, 'global_cap'::text,
      v_global[cardinality(v_global) - v_cfg.global_max + 1] + v_cfg.global_window, false;
    return;
  end if;

  -- 3. Règles par adresse de quota (D52).
  v_row := private.login_attempt_lock_row(p_identifier_hash);

  if v_row.locked_until is not null then
    return query select false, 'locked'::text, v_row.locked_until, false;
    return;
  end if;

  v_sends := array(
    select s.t from unnest(v_row.send_times) as s(t)
    where s.t > v_now - v_cfg.hourly_window
    order by s.t
  );
  v_count := cardinality(v_sends);

  if v_count >= v_cfg.hourly_max then
    update public.login_attempts la
      set send_times = v_sends
      where la.identifier_hash = p_identifier_hash;
    return query select false, 'hourly_cap'::text,
      v_sends[v_count - v_cfg.hourly_max + 1] + v_cfg.hourly_window, false;
    return;
  end if;

  if v_count > 0 and v_sends[v_count] > v_now - v_cfg.resend_interval then
    update public.login_attempts la
      set send_times = v_sends
      where la.identifier_hash = p_identifier_hash;
    return query select false, 'too_soon'::text, v_sends[v_count] + v_cfg.resend_interval, false;
    return;
  end if;

  -- 4. Émission : le nouveau code remplace le précédent ; pour un admin,
  --    AUCUN code utilisable n'est enregistré (mêmes quotas, même réponse).
  v_is_admin := public.auth_email_is_admin(p_email);

  update public.login_attempts la
    set send_times = v_sends || v_now,
        code_hmac = case when v_is_admin then null else p_code_hmac end,
        code_expires_at = case when v_is_admin then null else v_now + v_cfg.code_ttl end
    where la.identifier_hash = p_identifier_hash;

  update public.login_code_global_counter g
    set issue_times = v_global || v_now
    where g.id;

  v_sends := v_sends || v_now;
  v_count := v_count + 1;
  v_next := v_now + v_cfg.resend_interval;
  if v_count >= v_cfg.hourly_max then
    v_next := greatest(v_next, v_sends[v_count - v_cfg.hourly_max + 1] + v_cfg.hourly_window);
  end if;

  return query select true, 'ok'::text, v_next, not v_is_admin;
end;
$$;

comment on function public.login_code_issue(text, text, text, text, text) is
  'Serveur seulement (service_role), avant tout envoi de code : sous verrou, limite par IP (/64 puis /48 ; ip_limited), plafond global 300 / h (global_cap, alerte dans audit_log au plus une fois par heure), blocage (locked), 3 codes par heure (hourly_cap), 60 s (too_soon) ; sinon enregistre l''empreinte du code (tiré dans Node) à la place du précédent, valable 10 min (ok). Adresse admin : mêmes quotas, aucun code utilisable enregistré, deliver = false. Renvoie allowed, reason, retry_at, deliver (docs/06 D23, D24, D52 ; décisions du 2026-10-22).';

revoke all on function public.login_code_issue(text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.login_code_issue(text, text, text, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- 8. login_code_verify — vérification d'un code (route /verify)
-- ---------------------------------------------------------------------------
-- result : 'ok' (code juste : consommé, échecs remis à zéro ; la route crée
--          alors la session) | 'wrong' (code faux, expiré, absent, adresse
--          sans compte ou admin : échec compté) | 'locked' (blocage en cours,
--          ou posé par cet échec, le 5e) | 'ip_limited' (rien n'est compté
--          pour l'adresse).
-- retry_at : fin du blocage (locked) ou prochaine vérification admise pour
--   cette IP (ip_limited) ; nulle sinon.
create function public.login_code_verify(
  p_identifier_hash text,
  p_ip_hash text,
  p_ip48_hash text,
  p_code_hmac text,
  p_email text
)
returns table (result text, retry_at timestamptz)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := now();
  v_cfg record;
  v_ip_allowed boolean;
  v_ip_retry timestamptz;
  v_row public.login_attempts;
  v_is_admin boolean;
  v_code_live boolean;
  v_failures integer;
begin
  perform private.login_code_check_args(p_identifier_hash, p_code_hmac, p_email);
  select s.* into v_cfg from private.login_code_settings() as s;

  -- 1. Limite par IP (/64 puis /48), en premier.
  select g.allowed, g.retry_at into v_ip_allowed, v_ip_retry
    from private.login_ip_gate(p_ip_hash, p_ip48_hash, 'verify_code') as g;
  if v_ip_allowed is not true then
    return query select 'ip_limited'::text, v_ip_retry;
    return;
  end if;

  -- 2. Blocage (5 échecs) : aucune vérification (D52).
  v_row := private.login_attempt_lock_row(p_identifier_hash);

  if v_row.locked_until is not null then
    return query select 'locked'::text, v_row.locked_until;
    return;
  end if;

  -- 3. Comparaison. Jamais « ok » pour une adresse admin.
  v_is_admin := public.auth_email_is_admin(p_email);
  v_code_live := v_row.code_hmac is not null and v_row.code_expires_at > v_now;

  if v_code_live and not v_is_admin and v_row.code_hmac = p_code_hmac then
    -- Usage unique et remise à zéro, dans la même transaction.
    update public.login_attempts la
      set code_hmac = null, code_expires_at = null, failed_count = 0, locked_until = null
      where la.identifier_hash = p_identifier_hash;
    return query select 'ok'::text, null::timestamptz;
    return;
  end if;

  -- 4. Échec compté (même sans code actif ni compte).
  v_failures := v_row.failed_count + 1;

  if v_failures >= v_cfg.max_failures then
    update public.login_attempts la
      set failed_count = v_cfg.max_failures,
          locked_until = v_now + v_cfg.lock_duration,
          code_hmac = null,
          code_expires_at = null
      where la.identifier_hash = p_identifier_hash;
    return query select 'locked'::text, v_now + v_cfg.lock_duration;
    return;
  end if;

  update public.login_attempts la
    set failed_count = v_failures,
        code_hmac = case when v_code_live then la.code_hmac end,
        code_expires_at = case when v_code_live then la.code_expires_at end
    where la.identifier_hash = p_identifier_hash;

  return query select 'wrong'::text, null::timestamptz;
end;
$$;

comment on function public.login_code_verify(text, text, text, text, text) is
  'Serveur seulement (service_role), à chaque saisie de code : sous verrou, limite par IP (/64 puis /48 ; ip_limited), blocage (locked, aucune vérification), puis comparaison de l''empreinte : juste et non expirée → consommée (usage unique) et échecs remis à zéro (ok) ; sinon échec compté, même sans code ni compte, le 5e pose 15 min de blocage et efface le code (wrong / locked). Jamais ok pour une adresse admin. Renvoie result, retry_at (docs/06 D23, D24, D52 ; docs/07 § 17 ; décisions du 2026-10-22).';

revoke all on function public.login_code_verify(text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.login_code_verify(text, text, text, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- 9. Purge (tâche pg_cron existante « purge-login-attempts »)
-- ---------------------------------------------------------------------------
-- Même signature et même type de retour qu'en 20261021150200 : CREATE OR
-- REPLACE conserve le propriétaire, les droits et la tâche (commande
-- inchangée). Une ligne login_attempts encore bloquée n'est jamais
-- supprimée ; une ligne inactive depuis 48 h n'a plus de code valable
-- (10 min). La ligne du plafond global n'est jamais supprimée.
create or replace function private.purge_login_attempts()
returns integer
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_deleted integer;
  v_deleted_ip integer;
begin
  delete from public.login_attempts la
    where la.updated_at < now() - interval '48 hours'
      and (la.locked_until is null or la.locked_until <= now());
  get diagnostics v_deleted = row_count;

  delete from public.login_ip_attempts a
    where a.updated_at < now() - interval '48 hours';
  get diagnostics v_deleted_ip = row_count;

  return v_deleted + v_deleted_ip;
end;
$$;

comment on function private.purge_login_attempts() is
  'Supprime les lignes de login_attempts (hors blocage en cours) et de login_ip_attempts inactives depuis plus de 48 h (docs/07 § 2.1 ; décision du 2026-10-22). Lancée par pg_cron ; renvoie le nombre total de lignes supprimées.';

revoke all on function private.purge_login_attempts() from public, anon, authenticated, service_role;

-- Aide existante (20261021150200), inchangée : rappel de ses droits.
revoke all on function private.login_attempt_lock_row(text) from public, anon, authenticated, service_role;
