-- Tranche 1 — socle : structure, RLS activée partout, schéma private fermé,
-- 22 types énumérés, politiques exactes (docs/07 § 1.2 à § 1.4, § 17).
begin;
create extension if not exists pgtap with schema extensions;

select plan(43);

-- Tables du socle --------------------------------------------------------- (8)
select has_table('public', 'countries', 'table countries');
select has_table('public', 'platform_settings', 'table platform_settings');
select has_table('public', 'audit_log', 'table audit_log');
select has_table('public', 'analytics_events', 'table analytics_events');
select has_table('public', 'pricing_tiers', 'table pricing_tiers');
select has_table('public', 'whatsapp_rates', 'table whatsapp_rates');
select has_table('public', 'fx_rates', 'table fx_rates');
select has_table('public', 'whatsapp_templates', 'table whatsapp_templates');

-- RLS activée sur CHAQUE table du schéma public (présentes et futures) ---- (1)
select is(
  array(
    select c.relname::text
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and not c.relrowsecurity
    order by 1
  ),
  array[]::text[],
  'RLS activée sur chaque table du schéma public'
);

-- Schéma private fermé ---------------------------------------------------- (4)
select ok(
  not has_schema_privilege('anon', 'private', 'USAGE'),
  'anon n''a pas USAGE sur le schéma private'
);
select ok(
  not has_schema_privilege('authenticated', 'private', 'USAGE'),
  'authenticated n''a pas USAGE sur le schéma private'
);
select is(
  (
    select count(*)
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and (has_function_privilege('anon', p.oid, 'EXECUTE')
           or has_function_privilege('authenticated', p.oid, 'EXECUTE'))
  ),
  0::bigint,
  'aucune fonction de private n''est exécutable par anon / authenticated'
);
select is(
  (
    select count(*)
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and not exists (
        select 1 from unnest(coalesce(p.proconfig, array[]::text[])) as cfg
        where cfg like 'search_path=%'
      )
  ),
  0::bigint,
  'toutes les fonctions de private fixent search_path'
);

-- 22 types énumérés (07 § 1.4) ------------------------------------------ (22)
select enum_has_labels('public', 'event_type',
  array['wedding', 'dowry', 'baptism', 'birthday', 'baby_presentation', 'other'], 'enum event_type');
select enum_has_labels('public', 'organizer_status',
  array['active', 'suspended'], 'enum organizer_status');
select enum_has_labels('public', 'admin_role',
  array['super_admin', 'marketing', 'finance', 'support', 'content'], 'enum admin_role');
select enum_has_labels('public', 'billing_status',
  array['unpaid', 'trial', 'paid'], 'enum billing_status');
select enum_has_labels('public', 'table_naming',
  array['named', 'numbered'], 'enum table_naming');
select enum_has_labels('public', 'invitation_kind',
  array['single', 'plus_one'], 'enum invitation_kind');
select enum_has_labels('public', 'rsvp_status',
  array['pending', 'accepted', 'declined'], 'enum rsvp_status');
select enum_has_labels('public', 'rsvp_source',
  array['guest', 'check_in'], 'enum rsvp_source');
select enum_has_labels('public', 'check_in_who',
  array['both', 'main', 'companion'], 'enum check_in_who');
select enum_has_labels('public', 'check_in_result',
  array['admitted', 'partial', 'already_in', 'refused_main_absent', 'refused_strict', 'refused_other_event', 'invalid'],
  'enum check_in_result');
select enum_has_labels('public', 'payment_kind',
  array['initial', 'upgrade', 'extra_seats', 'quote'], 'enum payment_kind');
select enum_has_labels('public', 'payment_status',
  array['pending', 'approved', 'declined', 'canceled'], 'enum payment_status');
select enum_has_labels('public', 'refund_mode',
  array['fedapay_dashboard', 'manual_transfer'], 'enum refund_mode');
select enum_has_labels('public', 'refund_status',
  array['recorded', 'executed'], 'enum refund_status');
select enum_has_labels('public', 'quote_status',
  array['pending', 'quoted', 'paid', 'canceled'], 'enum quote_status');
select enum_has_labels('public', 'wa_category',
  array['marketing', 'utility', 'authentication', 'service'], 'enum wa_category');
select enum_has_labels('public', 'wa_purpose',
  array['invitation', 'invitation_resend', 'ticket', 'reminder_auto', 'reminder_manual',
        'event_update', 'thank_you', 'host_message', 'login_code', 'auto_reply'],
  'enum wa_purpose');
select enum_has_labels('public', 'wa_status',
  array['queued', 'sending', 'sent', 'delivered', 'read', 'failed', 'canceled'], 'enum wa_status');
select enum_has_labels('public', 'schedule_kind',
  array['bulk_send', 'reminder_auto', 'event_update'], 'enum schedule_kind');
select enum_has_labels('public', 'schedule_status',
  array['pending', 'done', 'canceled'], 'enum schedule_status');
select enum_has_labels('public', 'promo_kind',
  array['percent', 'fixed', 'tracking_only'], 'enum promo_kind');
select enum_has_labels('public', 'optout_source',
  array['button', 'stop_reply', 'blocked'], 'enum optout_source');

-- Politiques exactes (C6 : aucune politique admin en tranche 1) ----------- (8)
select policies_are('public', 'countries',
  array['countries_select_active_anon', 'countries_select_active_authenticated'],
  'countries : seulement la lecture des pays actifs (anon, authenticated)');
select policies_are('public', 'pricing_tiers',
  array['pricing_tiers_select_active_anon', 'pricing_tiers_select_active_authenticated'],
  'pricing_tiers : seulement la lecture des paliers actifs (anon, authenticated)');
select policies_are('public', 'platform_settings', array[]::name[],
  'platform_settings : aucune politique (serveur seul)');
select policies_are('public', 'audit_log', array[]::name[],
  'audit_log : aucune politique (serveur seul en tranche 1)');
select policies_are('public', 'analytics_events', array[]::name[],
  'analytics_events : aucune politique (serveur seul)');
select policies_are('public', 'whatsapp_rates', array[]::name[],
  'whatsapp_rates : aucune politique (serveur seul en tranche 1)');
select policies_are('public', 'fx_rates', array[]::name[],
  'fx_rates : aucune politique (serveur seul en tranche 1)');
select policies_are('public', 'whatsapp_templates', array[]::name[],
  'whatsapp_templates : aucune politique (serveur seul en tranche 1)');

select * from finish();
rollback;
