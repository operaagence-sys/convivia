import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { requireServerEnv } from '@/lib/env/server';
import type { Database } from '@/types/database';

/**
 * Client service_role: contourne la RLS. SERVEUR UNIQUEMENT (`server-only`): ne jamais
 * l'importer depuis un composant client. À réserver aux webhooks, tâches et opérations que la
 * RLS ne permet pas; vérifier d'abord les droits de l'appelant. Aucune session persistée.
 */
export function createServiceRoleClient() {
  const env = requireServerEnv('NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY');
  return createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
