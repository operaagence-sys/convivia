import 'server-only';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { getPublicSupabaseConfig } from '@/lib/env/public';
import type { Database } from '@/types/database';

/**
 * Client anonyme sans cookies ni session, pour les pages invités (`/i/*`): il ne lit et
 * n'écrit aucun cookie d'authentification. Les appels passent par les fonctions Postgres
 * prévues (`get_guest_view`, `mark_opened`, `submit_rsvp`).
 */
export function createAnonServerClient() {
  const { url, anonKey } = getPublicSupabaseConfig();
  return createSupabaseClient<Database>(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
