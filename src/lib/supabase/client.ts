import { createBrowserClient } from '@supabase/ssr';
import { getPublicSupabaseConfig } from '@/lib/env/public';
import type { Database } from '@/types/database';

/**
 * Client Supabase navigateur (clé anonyme, soumis à la RLS). Jamais de clé service_role ici.
 * Lève une erreur claire si les variables publiques manquent.
 */
export function createClient() {
  const { url, anonKey } = getPublicSupabaseConfig();
  return createBrowserClient<Database>(url, anonKey);
}
