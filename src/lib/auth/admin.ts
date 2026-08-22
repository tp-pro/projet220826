import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';

import { db } from '@/db/client';
import { users } from '@/db/schema';
import { createClient } from '@/lib/supabase/server';

/**
 * Vérifie que l'utilisateur connecté a le rôle admin, sinon redirige
 * (`/connexion` si pas connecté, `/` si connecté mais pas admin).
 *
 * ⚠️ Une Server Action n'hérite PAS de la protection des pages/layouts qui l'invoquent :
 * elle reste appelable directement. Chaque Server Action des sections /admin doit donc
 * appeler cette fonction elle-même en première ligne, pas seulement les pages.
 */
export async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    redirect('/connexion');
  }

  const [dbUser] = await db.select().from(users).where(eq(users.id, authUser.id)).limit(1);

  if (!dbUser || dbUser.role !== 'admin') {
    redirect('/');
  }

  return { authUser, dbUser };
}
