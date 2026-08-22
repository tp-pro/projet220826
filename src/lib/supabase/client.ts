import { createBrowserClient } from '@supabase/ssr';

import { env } from '@/config/env';

/**
 * Client Supabase pour les Client Components ("use client").
 * Utilise la clé publique (anon) — soumise aux policies RLS.
 */
export function createClient() {
  return createBrowserClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
