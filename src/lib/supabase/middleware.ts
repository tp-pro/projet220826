import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

import { env } from '@/config/env';

/**
 * Rafraîchit le token de session Supabase à chaque requête et propage les cookies
 * mis à jour à la fois vers la requête (pour les Server Components de cette navigation)
 * et vers la réponse (pour le navigateur). Appelé depuis src/middleware.ts.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    }
  );

  // Ne pas retirer : rafraîchit le token si besoin (déclenche getClaims/getUser en interne).
  await supabase.auth.getClaims();

  return response;
}
