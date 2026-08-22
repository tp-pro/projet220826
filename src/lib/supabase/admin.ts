import { createClient as createSupabaseClient } from '@supabase/supabase-js';

import { env } from '@/config/env';

/**
 * Client Supabase "admin" — utilise la clé `service_role` qui BYPASS Row Level Security.
 *
 * ⚠️ Ne jamais importer ce fichier depuis un Client Component ("use client") ni depuis
 * un chemin de code accessible au navigateur. Réservé aux scripts serveur (seed, tâches
 * d'administration) et, plus tard, aux Server Actions/Route Handlers qui en ont explicitement
 * besoin (ex: modération admin bypassant les policies RLS).
 */
export function createAdminClient() {
  return createSupabaseClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
