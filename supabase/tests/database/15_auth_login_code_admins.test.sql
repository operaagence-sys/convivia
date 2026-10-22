-- Tranche 2 — refonte de la connexion : adresses admin (login_code_issue /
-- login_code_verify, migration 20261022120100).
-- Sources : revue de conception du security-reviewer (changement 3 : mêmes
-- quotas, aucun code utilisable stocké, jamais « ok ») ; docs/06 § 7.1, § 8.1,
-- D13, D23, D33 ; docs/07 § 2.2.
-- La base décide elle-même qu'une adresse est admin (public.auth_email_is_admin
-- sur l'e-mail exact reçu en paramètre) : la route ne peut pas l'oublier.
-- Données fictives (domaine réservé example.com) ; tout est annulé.
begin;
create extension if not exists pgtap with schema extensions;

select plan(15);

update public.login_code_global_counter set issue_times = '{}' where id;

insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-4000-8000-0000000015a1', 'admin.actif@example.com', now()),
  ('00000000-0000-4000-8000-0000000015a2', 'admin.desactive@example.com', now()),
  ('00000000-0000-4000-8000-0000000015a3', 'admin.auth@example.com', now());

insert into public.admin_users (user_id, full_name, email, is_active) values
  ('00000000-0000-4000-8000-0000000015a1', 'Admin Actif', 'admin.actif@example.com', true),
  ('00000000-0000-4000-8000-0000000015a2', 'Admin Desactive', 'admin.desactive@example.com', false),
  -- e-mail de admin_users différent de celui de auth.users : reconnu par l'un ou l'autre
  ('00000000-0000-4000-8000-0000000015a3', 'Admin Autre', 'admin.autre@example.com', true);

set local role service_role;

-- Admin actif : mêmes quotas, aucun code utilisable ------------------------- (5)
select results_eq(
  $$select allowed, reason, retry_at, deliver
    from public.login_code_issue(repeat('a', 64), repeat('a0', 32), null, repeat('c1', 32), 'admin.actif@example.com')$$,
  $$values (true, 'ok', now() + interval '60 seconds', false)$$,
  'admin : même réponse qu''un succès, mais deliver = false (aucun e-mail)'
);

reset role;
select results_eq(
  $$select code_hmac, code_expires_at, cardinality(send_times)
    from public.login_attempts where identifier_hash = repeat('a', 64)$$,
  $$values (null::text, null::timestamptz, 1)$$,
  'admin : aucune empreinte de code enregistrée, mais l''envoi compte (mêmes quotas)'
);
set local role service_role;

select results_eq(
  $$select allowed, reason, retry_at, deliver
    from public.login_code_issue(repeat('a', 64), repeat('a0', 32), null, repeat('c2', 32), 'admin.actif@example.com')$$,
  $$values (false, 'too_soon', now() + interval '60 seconds', false)$$,
  'admin : délai de 60 s appliqué comme pour tout le monde'
);
select results_eq(
  $$select result, retry_at
    from public.login_code_verify(repeat('a', 64), repeat('a0', 32), null, repeat('c1', 32), 'admin.actif@example.com')$$,
  $$values ('wrong', null::timestamptz)$$,
  'admin : l''empreinte transmise à l''émission ne vaut rien (wrong)'
);

reset role;
select is((select failed_count from public.login_attempts where identifier_hash = repeat('a', 64)), 1::smallint,
  'admin : l''échec est compté comme pour tout le monde');

-- Jamais « ok » pour un admin, même avec une empreinte correspondante ------- (4)
update public.login_attempts
  set code_hmac = repeat('c7', 32), code_expires_at = now() + interval '10 minutes'
  where identifier_hash = repeat('a', 64);
set local role service_role;

select results_eq(
  $$select result
    from public.login_code_verify(repeat('a', 64), repeat('a0', 32), null, repeat('c7', 32), 'admin.actif@example.com')$$,
  $$values ('wrong')$$,
  'admin : empreinte juste et non expirée (posée à la main) → wrong, jamais ok'
);
select results_eq(
  $$select allowed, reason, deliver
    from public.login_code_issue(repeat('b', 64), repeat('b0', 32), null, repeat('c3', 32), 'admin.actif+x@example.com')$$,
  $$values (true, 'ok', true)$$,
  'variante « +tag » d''une adresse admin (autre compte, non admin) : code émis et envoyé'
);
select results_eq(
  $$select result
    from public.login_code_verify(repeat('b', 64), repeat('b0', 32), null, repeat('c3', 32), 'admin.actif@example.com')$$,
  $$values ('wrong')$$,
  'même empreinte de quota, e-mail admin : wrong (la base refuse même si la route se trompait d''adresse)'
);
select results_eq(
  $$select result
    from public.login_code_verify(repeat('b', 64), repeat('b0', 32), null, repeat('c3', 32), 'admin.actif+x@example.com')$$,
  $$values ('ok')$$,
  'le même code reste valable pour le compte non admin qui l''a demandé'
);

-- Admin désactivé, admin reconnu par auth.users ------------------------------ (3)
select results_eq(
  $$select allowed, reason, deliver
    from public.login_code_issue(repeat('c', 64), repeat('c0', 32), null, repeat('c1', 32), 'admin.desactive@example.com')$$,
  $$values (true, 'ok', false)$$,
  'admin désactivé : toujours exclu du parcours organisateur (deliver = false)'
);
select results_eq(
  $$select result
    from public.login_code_verify(repeat('c', 64), repeat('c0', 32), null, repeat('c1', 32), 'admin.desactive@example.com')$$,
  $$values ('wrong')$$,
  'admin désactivé : jamais ok'
);
select results_eq(
  $$select deliver
    from public.login_code_issue(repeat('d', 64), repeat('d0', 32), null, repeat('c1', 32), 'admin.auth@example.com')$$,
  $$values (false)$$,
  'admin reconnu par l''e-mail de son compte auth.users (même si admin_users.email diffère)'
);

-- Réponse indistinguable, blocage, ensure_organizer -------------------------- (3)
select results_eq(
  $$select allowed, reason, retry_at
    from public.login_code_issue(repeat('e', 64), repeat('e0', 32), null, repeat('c1', 32), 'admin.actif@example.com')$$,
  $$select allowed, reason, retry_at
    from public.login_code_issue(repeat('f', 64), repeat('f0', 32), null, repeat('c1', 32), 'organisateur.f@example.com')$$,
  'admin et organisateur : réponse identique (allowed, reason, retry_at), D23'
);

reset role;
update public.login_attempts set failed_count = 4 where identifier_hash = repeat('a', 64);
set local role service_role;

select results_eq(
  $$select result, retry_at
    from public.login_code_verify(repeat('a', 64), repeat('a0', 32), null, repeat('c7', 32), 'admin.actif@example.com')$$,
  $$values ('locked', now() + interval '15 minutes')$$,
  'admin : 5e échec → blocage de 15 min, comme pour tout le monde'
);
select throws_ok(
  $$select * from public.ensure_organizer('00000000-0000-4000-8000-0000000015a1')$$,
  'P0001', 'admin_account', 'ensure_organizer refuse toujours un compte admin'
);

select * from finish();
rollback;
