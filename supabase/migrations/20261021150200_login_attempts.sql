-- Tranche 2 — connexion (3/4) : compteur des codes de connexion
-- (login_attempts) et ses fonctions serveur.
-- Sources : docs/07-schema-backend.md § 2.1 (login_attempts), § 13, § 17
-- (« 6e code faux refusé pendant 15 min, même pour un identifiant sans
-- compte ») ; docs/06-trd.md § 7.1, § 7.2, D23, D24, D52, D56 ;
-- docs/09-conventions.md § 2.
--
-- Règles (D24, D52, TRD § 7.1) :
-- - 5 codes faux → blocage de 15 min, SANS vérification NI nouvel envoi pour
--   cet identifiant ;
-- - 3 codes envoyés au plus par identifiant sur une heure glissante ;
-- - un nouvel envoi au plus toutes les 60 s (aussi réglé dans Supabase Auth,
--   repris ici pour qu'un envoi refusé par Auth ne consomme pas le quota) ;
-- - compteur d'échecs remis à zéro après un code juste ;
-- - indexé par EMPREINTE de l'identifiant : le compte peut ne pas exister
--   (D23), la table ne dit pas qui a essayé.
--
-- Empreinte : identifier_hash = HMAC-SHA256(e-mail normalisé, secret) en
-- hexadécimal minuscule (64 caractères), calculée CÔTÉ SERVEUR Node (route
-- de /login et de /verify) avec la variable d'environnement
-- LOGIN_ATTEMPTS_HASH_SECRET ; e-mail normalisé = minuscules, espaces de bord
-- retirés. Le secret n'est pas dans la base : une fuite de la table ne
-- permet pas de tester des adresses.
--
-- Atomicité : chaque fonction verrouille la ligne de l'identifiant
-- (SELECT … FOR UPDATE) et décide dans la même transaction. Le contrôle
-- « bloqué ? » et l'enregistrement de l'envoi sont une seule opération
-- (login_attempt_before_send) ; une tentative de vérification est comptée
-- AVANT l'appel à Supabase Auth (login_attempt_before_verify) puis le
-- compteur est remis à zéro si le code est juste (login_attempt_reset).
-- Ainsi des vérifications lancées en parallèle ne dépassent jamais 5
-- tentatives : il n'y a pas de fonction « enregistrer un échec » séparée.
--
-- Accès : table fermée à tous les rôles de l'API, service_role compris ;
-- seules les fonctions ci-dessous (SECURITY DEFINER, EXECUTE accordé à
-- service_role seulement) la lisent et l'écrivent. Limite connue D56 : un
-- appel direct à Supabase Auth échappe à ce compteur (limites par IP de
-- Supabase réglées par le devops-engineer).

-- ---------------------------------------------------------------------------
-- 1. login_attempts (07 § 2.1)
-- ---------------------------------------------------------------------------
create table public.login_attempts (
  identifier_hash text primary key,
  failed_count smallint not null default 0,
  locked_until timestamptz,
  send_times timestamptz[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint login_attempts_identifier_hash_format check (identifier_hash ~ '^[0-9a-f]{64}$'),
  constraint login_attempts_failed_count_range check (failed_count between 0 and 5),
  -- 5 tentatives comptées = blocage posé.
  constraint login_attempts_lock_consistency check (failed_count < 5 or locked_until is not null),
  constraint login_attempts_send_times_bounded check (
    cardinality(send_times) <= 3 and array_position(send_times, null) is null
  )
);

comment on table public.login_attempts is
  'Compteur des codes de connexion, indexé par l''empreinte HMAC de l''e-mail (le compte peut ne pas exister). Aucun droit pour anon, authenticated ni service_role : accès par les fonctions login_attempt_* seulement ; purge à 48 h d''inactivité (docs/07 § 2.1 ; docs/06 D24, D52).';
comment on column public.login_attempts.identifier_hash is
  'HMAC-SHA256(e-mail en minuscules sans espaces de bord, LOGIN_ATTEMPTS_HASH_SECRET), hexadécimal minuscule, calculé par le serveur Node.';
comment on column public.login_attempts.failed_count is
  'Tentatives de vérification comptées depuis le dernier code juste ou la fin du dernier blocage (0 à 5). Comptée avant la vérification, remise à 0 si le code est juste.';
comment on column public.login_attempts.locked_until is
  'Fin du blocage de 15 min posé à la 5e tentative (levé si cette 5e tentative est juste). Pendant le blocage : ni vérification ni envoi (D52).';
comment on column public.login_attempts.send_times is
  'Dates des codes envoyés dans l''heure glissante (3 au plus, D52). Colonne ajoutée à 07 § 2.1 pour le plafond horaire de D52.';

create index login_attempts_updated_at_idx on public.login_attempts (updated_at);

create trigger login_attempts_set_updated_at
  before update on public.login_attempts
  for each row execute function private.set_updated_at();

alter table public.login_attempts enable row level security;

-- Aucune politique et aucun droit de table : serveur seulement, par les
-- fonctions ci-dessous (07 § 13 : « serveur seul »).
revoke all on table public.login_attempts from anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Aide interne : valider, créer si besoin, verrouiller la ligne
-- ---------------------------------------------------------------------------
-- Appelée seulement par les fonctions SECURITY DEFINER ci-dessous (qui
-- s'exécutent en tant que propriétaire) ; aucun EXECUTE pour les rôles de
-- l'API. Lève le blocage s'il est échu (compteur remis à zéro).
create function private.login_attempt_lock_row(p_identifier_hash text)
returns public.login_attempts
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_row public.login_attempts;
begin
  if p_identifier_hash is null or p_identifier_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid identifier_hash (expected 64 lowercase hex characters)'
      using errcode = '22023';
  end if;

  insert into public.login_attempts (identifier_hash)
    values (p_identifier_hash)
    on conflict on constraint login_attempts_pkey do nothing;

  select la.* into v_row
    from public.login_attempts la
    where la.identifier_hash = p_identifier_hash
    for update;

  if v_row.locked_until is not null and v_row.locked_until <= now() then
    update public.login_attempts la
      set failed_count = 0, locked_until = null
      where la.identifier_hash = p_identifier_hash
      returning la.* into v_row;
  end if;

  return v_row;
end;
$$;

comment on function private.login_attempt_lock_row(text) is
  'Interne : valide l''empreinte, crée la ligne si besoin, la verrouille (FOR UPDATE) et lève un blocage échu. Appelée par les fonctions login_attempt_* (docs/07 § 2.1).';

revoke all on function private.login_attempt_lock_row(text) from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. login_attempt_before_send — avant d'envoyer un code (route /login)
-- ---------------------------------------------------------------------------
-- À appeler pour TOUT identifiant saisi, y compris l'e-mail d'un admin (qui
-- ne recevra rien) : sinon le plafond ne se déclencherait jamais pour un
-- admin, ce qui révélerait l'adresse. Si allowed, l'envoi est ENREGISTRÉ
-- (il compte même si l'envoi échoue ensuite).
-- reason : 'ok' | 'locked' (5 codes faux, retry_at = fin du blocage)
--        | 'hourly_cap' (3 codes dans l'heure, retry_at = sortie du plus
--          ancien de la fenêtre) | 'too_soon' (moins de 60 s depuis le
--          dernier envoi, retry_at = dernier envoi + 60 s).
create function public.login_attempt_before_send(p_identifier_hash text)
returns table (allowed boolean, reason text, retry_at timestamptz)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_row public.login_attempts;
  v_now timestamptz := now();
  v_sends timestamptz[];
  v_count integer;
begin
  v_row := private.login_attempt_lock_row(p_identifier_hash);

  if v_row.locked_until is not null then
    return query select false, 'locked'::text, v_row.locked_until;
    return;
  end if;

  -- Fenêtre glissante d'une heure, du plus ancien au plus récent.
  v_sends := array(
    select s.t
    from unnest(v_row.send_times) as s(t)
    where s.t > v_now - interval '1 hour'
    order by s.t
  );
  v_count := cardinality(v_sends);

  if v_count >= 3 then
    update public.login_attempts la
      set send_times = v_sends
      where la.identifier_hash = p_identifier_hash;
    return query select false, 'hourly_cap'::text, v_sends[1] + interval '1 hour';
    return;
  end if;

  if v_count > 0 and v_sends[v_count] > v_now - interval '60 seconds' then
    update public.login_attempts la
      set send_times = v_sends
      where la.identifier_hash = p_identifier_hash;
    return query select false, 'too_soon'::text, v_sends[v_count] + interval '60 seconds';
    return;
  end if;

  update public.login_attempts la
    set send_times = v_sends || v_now
    where la.identifier_hash = p_identifier_hash;

  return query select true, 'ok'::text, null::timestamptz;
end;
$$;

comment on function public.login_attempt_before_send(text) is
  'Serveur seulement (service_role), avant tout envoi de code : refuse si bloqué (locked), 3 codes dans l''heure (hourly_cap) ou moins de 60 s (too_soon), sinon enregistre l''envoi (ok). Renvoie allowed, reason, retry_at (docs/06 D24, D52, § 7.1).';

revoke all on function public.login_attempt_before_send(text) from public, anon, authenticated;
grant execute on function public.login_attempt_before_send(text) to service_role;

-- ---------------------------------------------------------------------------
-- 4. login_attempt_before_verify — avant de vérifier un code (route /verify)
-- ---------------------------------------------------------------------------
-- Compte la tentative AVANT l'appel à Supabase Auth. Si allowed = false
-- (reason 'locked'), ne PAS appeler verifyOtp (D52 : aucune vérification
-- pendant le blocage). La 5e tentative pose le blocage d'avance
-- (lock_expires_at renseigné) : un code juste le lève par
-- login_attempt_reset ; un code faux le laisse en place.
-- attempts_left = tentatives restantes si celle-ci échoue (0 = bloqué en cas
-- d'échec, jusqu'à lock_expires_at).
create function public.login_attempt_before_verify(p_identifier_hash text)
returns table (allowed boolean, reason text, lock_expires_at timestamptz, attempts_left smallint)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_row public.login_attempts;
  v_count smallint;
begin
  v_row := private.login_attempt_lock_row(p_identifier_hash);

  if v_row.locked_until is not null then
    return query select false, 'locked'::text, v_row.locked_until, 0::smallint;
    return;
  end if;

  v_count := v_row.failed_count + 1;

  update public.login_attempts la
    set failed_count = v_count,
        locked_until = case when v_count >= 5 then now() + interval '15 minutes' end
    where la.identifier_hash = p_identifier_hash
    returning la.* into v_row;

  return query select true, 'ok'::text, v_row.locked_until, (5 - v_count)::smallint;
end;
$$;

comment on function public.login_attempt_before_verify(text) is
  'Serveur seulement (service_role), avant verifyOtp : refuse si bloqué (locked, ne pas vérifier), sinon compte la tentative ; la 5e pose un blocage de 15 min, levé par login_attempt_reset si le code est juste. Renvoie allowed, reason, lock_expires_at, attempts_left (docs/06 D24, D52 ; docs/07 § 17).';

revoke all on function public.login_attempt_before_verify(text) from public, anon, authenticated;
grant execute on function public.login_attempt_before_verify(text) to service_role;

-- ---------------------------------------------------------------------------
-- 5. login_attempt_reset — après un code juste
-- ---------------------------------------------------------------------------
-- Remet le compteur d'échecs à zéro et lève le blocage posé d'avance par la
-- 5e tentative. Ne touche pas aux envois de l'heure (le plafond de 3 codes
-- par heure reste valable après une connexion réussie).
create function public.login_attempt_reset(p_identifier_hash text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform private.login_attempt_lock_row(p_identifier_hash);

  update public.login_attempts la
    set failed_count = 0, locked_until = null
    where la.identifier_hash = p_identifier_hash;
end;
$$;

comment on function public.login_attempt_reset(text) is
  'Serveur seulement (service_role), après un code juste : compteur d''échecs à zéro, blocage levé ; les envois de l''heure sont conservés (docs/06 D52).';

revoke all on function public.login_attempt_reset(text) from public, anon, authenticated;
grant execute on function public.login_attempt_reset(text) to service_role;

-- ---------------------------------------------------------------------------
-- 6. login_attempt_status — lecture seule (affichage, Send Email Hook)
-- ---------------------------------------------------------------------------
-- N'écrit rien et ne crée pas de ligne. Sert à afficher l'état de /verify
-- (décompte du blocage, renvoi possible) et, si le Send Email Hook reçoit un
-- jour le secret HMAC, à refuser un envoi pendant un blocage.
-- lock_expires_at : fin du blocage en cours (nul sinon) ; attempts_left :
-- tentatives de vérification restantes ; next_send_at : date du prochain
-- envoi possible (nul = possible maintenant, hors blocage).
create function public.login_attempt_status(p_identifier_hash text)
returns table (lock_expires_at timestamptz, attempts_left smallint, next_send_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_row public.login_attempts;
  v_now timestamptz := now();
  v_sends timestamptz[];
  v_count integer;
  v_next timestamptz;
begin
  if p_identifier_hash is null or p_identifier_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid identifier_hash (expected 64 lowercase hex characters)'
      using errcode = '22023';
  end if;

  select la.* into v_row
    from public.login_attempts la
    where la.identifier_hash = p_identifier_hash;

  if not found then
    return query select null::timestamptz, 5::smallint, null::timestamptz;
    return;
  end if;

  if v_row.locked_until is not null and v_row.locked_until > v_now then
    return query select v_row.locked_until, 0::smallint, v_row.locked_until;
    return;
  end if;

  v_sends := array(
    select s.t
    from unnest(v_row.send_times) as s(t)
    where s.t > v_now - interval '1 hour'
    order by s.t
  );
  v_count := cardinality(v_sends);

  if v_count >= 3 then
    v_next := v_sends[1] + interval '1 hour';
  elsif v_count > 0 and v_sends[v_count] > v_now - interval '60 seconds' then
    v_next := v_sends[v_count] + interval '60 seconds';
  end if;

  return query select
    null::timestamptz,
    (case when v_row.locked_until is not null then 5 else 5 - v_row.failed_count end)::smallint,
    v_next;
end;
$$;

comment on function public.login_attempt_status(text) is
  'Serveur seulement (service_role), lecture seule : lock_expires_at (blocage en cours), attempts_left, next_send_at (prochain envoi possible) ; identifiant inconnu → (null, 5, null) (docs/06 D24, D52).';

revoke all on function public.login_attempt_status(text) from public, anon, authenticated;
grant execute on function public.login_attempt_status(text) to service_role;

-- ---------------------------------------------------------------------------
-- 7. Purge des lignes inactives depuis plus de 48 h (07 § 2.1)
-- ---------------------------------------------------------------------------
-- Lancée chaque heure par pg_cron (migration 20261021150300). Une ligne
-- encore bloquée n'est jamais supprimée (le blocage dure 15 min, donc ce cas
-- ne se présente pas en pratique).
create function private.purge_login_attempts()
returns integer
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_deleted integer;
begin
  delete from public.login_attempts la
    where la.updated_at < now() - interval '48 hours'
      and (la.locked_until is null or la.locked_until <= now());
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

comment on function private.purge_login_attempts() is
  'Supprime les lignes de login_attempts inactives depuis plus de 48 h (docs/07 § 2.1). Lancée par pg_cron ; renvoie le nombre de lignes supprimées.';

revoke all on function private.purge_login_attempts() from public, anon, authenticated, service_role;
