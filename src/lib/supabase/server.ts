import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

import { env } from '@/config/env';

/**
 * Client Supabase pour les Server Components, Server Actions et Route Handlers.
 * Utilise la clé publique (anon) — soumise aux policies RLS. La session est lue/écrite
 * via les cookies de la requête Next.js.
 *
 * ⚠️ À instancier à chaque requête (ne pas réutiliser une instance entre requêtes).
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // `setAll` appelé depuis un Server Component : ignorable si le middleware
          // rafraîchit déjà la session (voir src/middleware.ts).
        }
      },
    },
  });
}
