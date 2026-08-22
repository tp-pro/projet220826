'use server';

import { and, eq, inArray } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { db } from '@/db/client';
import { bookings, listings, users } from '@/db/schema';
import { ALLOWED_AVATAR_TYPES, MAX_AVATAR_SIZE_BYTES } from '@/lib/profile/constants';
import { uploadAvatar } from '@/lib/profile/storage';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export type UpdateProfileActionState = {
  error: string | null;
  success: boolean;
};

export async function updateProfileAction(
  _prevState: UpdateProfileActionState,
  formData: FormData
): Promise<UpdateProfileActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Tu dois être connecté.', success: false };
  }

  const city = String(formData.get('city') ?? '').trim();
  const birthDateRaw = String(formData.get('birthDate') ?? '').trim();

  let birthDate: Date | null = null;
  if (birthDateRaw) {
    const parsed = new Date(birthDateRaw);
    if (Number.isNaN(parsed.getTime())) {
      return { error: 'Date de naissance invalide.', success: false };
    }
    if (parsed > new Date()) {
      return { error: 'La date de naissance ne peut pas être dans le futur.', success: false };
    }
    birthDate = parsed;
  }

  const avatarEntry = formData.get('avatar');
  const avatarFile = avatarEntry instanceof File && avatarEntry.size > 0 ? avatarEntry : null;
  const removeAvatar = formData.get('removeAvatar') === 'on';

  if (avatarFile) {
    if (!(ALLOWED_AVATAR_TYPES as readonly string[]).includes(avatarFile.type)) {
      return { error: 'Photo de profil : formats acceptés — JPEG, PNG ou WEBP.', success: false };
    }
    if (avatarFile.size > MAX_AVATAR_SIZE_BYTES) {
      return { error: 'La photo de profil doit faire moins de 5 Mo.', success: false };
    }
  }

  // `undefined` = on ne touche pas à la colonne (garde la photo actuelle en base) ; même
  // convention que `coverImageUrl` dans updateFestivalAction — jamais fait confiance à une
  // URL transmise par le client, seule l'app côté serveur décide.
  let avatarUrl: string | null | undefined;
  if (avatarFile) {
    try {
      avatarUrl = await uploadAvatar(user.id, avatarFile);
    } catch {
      return { error: "Échec de l'envoi de la photo de profil — réessaie.", success: false };
    }
  } else if (removeAvatar) {
    avatarUrl = null;
  }

  await db
    .update(users)
    .set({
      city: city || null,
      birthDate,
      ...(avatarUrl !== undefined ? { avatarUrl } : {}),
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  revalidatePath('/compte');

  return { error: null, success: true };
}

/**
 * Raison pour laquelle un compte ne peut pas être supprimé, ou `null` si la suppression est
 * possible — utilisé à la fois pour griser le bouton côté page et pour revérifier côté serveur
 * avant d'agir (jamais fait confiance à l'état désactivé du bouton seul, voir
 * deleteAccountAction). Un logement (quel que soit son statut) doit d'abord être supprimé (voir
 * deleteListingAction) ; une réservation `pending` ou `accepted` (guest) doit d'abord être
 * refusée/résolue ou attendre son issue.
 */
export async function accountDeletionBlockReason(userId: string): Promise<string | null> {
  const [listing] = await db
    .select({ id: listings.id })
    .from(listings)
    .where(eq(listings.hostId, userId))
    .limit(1);
  if (listing) {
    return 'Tu as un logement, tu ne peux pas supprimer ton compte. Supprime-le d’abord.';
  }

  const [activeBooking] = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(and(eq(bookings.guestId, userId), inArray(bookings.status, ['pending', 'accepted'])))
    .limit(1);
  if (activeBooking) {
    return 'Tu as une réservation en attente ou en cours, tu ne peux pas supprimer ton compte.';
  }

  return null;
}

export type DeleteAccountActionState = { error: string | null };

// Signature imposée par useActionState — aucun des deux paramètres n'est nécessaire ici.
export async function deleteAccountAction(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _prevState: DeleteAccountActionState,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _formData: FormData
): Promise<DeleteAccountActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Tu dois être connecté.' };
  }

  const blockReason = await accountDeletionBlockReason(user.id);
  if (blockReason) {
    return { error: blockReason };
  }

  // Supprime d'abord la ligne applicative (cascade vers avis, demandes de mise en relation
  // résolues, etc. — voir onDelete: 'cascade' sur users dans src/db/schema.ts), puis le compte
  // d'authentification lui-même : les deux sont indépendants côté base (pas de FK entre
  // auth.users et public.users, seulement synchronisés à la création, voir
  // drizzle/0001_sync_auth_users.sql), donc les deux suppressions sont explicites ici.
  try {
    await db.delete(users).where(eq(users.id, user.id));
  } catch {
    return { error: 'Échec de la suppression du compte — réessaie.' };
  }

  const admin = createAdminClient();
  const { error: authError } = await admin.auth.admin.deleteUser(user.id);
  if (authError) {
    return {
      error: 'Ton profil a été supprimé mais une erreur est survenue — contacte le support.',
    };
  }

  await supabase.auth.signOut();
  redirect('/');
}
