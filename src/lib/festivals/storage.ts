import { FESTIVAL_COVERS_BUCKET } from '@/lib/festivals/constants';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Upload une image de couverture de festival vers Supabase Storage et retourne son URL
 * publique. Utilise le client admin (service_role) — appelé uniquement depuis une Server
 * Action déjà protégée par `requireAdmin()` (voir src/lib/admin/festivals-actions.ts).
 */
export async function uploadFestivalCover(festivalId: string, file: File): Promise<string> {
  const admin = createAdminClient();
  const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `${festivalId}/${crypto.randomUUID()}.${extension}`;

  const { error } = await admin.storage.from(FESTIVAL_COVERS_BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });

  if (error) {
    throw new Error(`Échec de l'upload de l'image : ${error.message}`);
  }

  const {
    data: { publicUrl },
  } = admin.storage.from(FESTIVAL_COVERS_BUCKET).getPublicUrl(path);

  return publicUrl;
}
