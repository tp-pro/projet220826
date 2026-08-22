import { AVATARS_BUCKET } from '@/lib/profile/constants';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Upload une photo de profil vers Supabase Storage et retourne son URL publique. Utilise le
 * client admin (service_role) — appelé uniquement depuis une Server Action déjà authentifiée
 * (voir src/lib/profile/actions.ts), jamais exposé côté client. Même pattern que
 * uploadListingPhoto()/uploadFestivalCover().
 */
export async function uploadAvatar(userId: string, file: File): Promise<string> {
  const admin = createAdminClient();
  const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `${userId}/${crypto.randomUUID()}.${extension}`;

  const { error } = await admin.storage.from(AVATARS_BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });

  if (error) {
    throw new Error(`Échec de l'upload de la photo de profil : ${error.message}`);
  }

  const {
    data: { publicUrl },
  } = admin.storage.from(AVATARS_BUCKET).getPublicUrl(path);

  return publicUrl;
}
