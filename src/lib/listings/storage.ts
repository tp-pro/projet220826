import { LISTING_CERTIFICATION_DOCS_BUCKET, LISTING_PHOTOS_BUCKET } from '@/lib/listings/constants';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Upload une photo de logement vers Supabase Storage et retourne son URL publique.
 * Utilise le client admin (service_role) — appelé uniquement depuis une Server Action déjà
 * authentifiée (voir src/lib/listings/actions.ts), jamais exposé côté client.
 */
export async function uploadListingPhoto(listingId: string, file: File): Promise<string> {
  const admin = createAdminClient();
  const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `${listingId}/${crypto.randomUUID()}.${extension}`;

  const { error } = await admin.storage.from(LISTING_PHOTOS_BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });

  if (error) {
    throw new Error(`Échec de l'upload de la photo : ${error.message}`);
  }

  const {
    data: { publicUrl },
  } = admin.storage.from(LISTING_PHOTOS_BUCKET).getPublicUrl(path);

  return publicUrl;
}

/**
 * Upload un justificatif de domicile (facture EDF, internet...) vers un bucket Storage privé
 * et retourne son chemin — jamais d'URL publique (contrairement aux photos), ce document
 * contient des données personnelles de l'hôte. Voir `getCertificationDocumentUrl()` pour
 * générer un lien temporaire (usage admin uniquement).
 */
export async function uploadCertificationDocument(listingId: string, file: File): Promise<string> {
  const admin = createAdminClient();
  const extension =
    file.type === 'application/pdf'
      ? 'pdf'
      : file.type === 'image/png'
        ? 'png'
        : file.type === 'image/webp'
          ? 'webp'
          : 'jpg';
  const path = `${listingId}/${crypto.randomUUID()}.${extension}`;

  const { error } = await admin.storage.from(LISTING_CERTIFICATION_DOCS_BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });

  if (error) {
    throw new Error(`Échec de l'upload du justificatif : ${error.message}`);
  }

  return path;
}

/** Supprime un justificatif du bucket privé — n'échoue pas bruyamment (fichier déjà orphelin
 * ou absent n'est pas bloquant, cf. limite connue équivalente sur les photos). */
export async function deleteCertificationDocument(path: string): Promise<void> {
  const admin = createAdminClient();
  await admin.storage.from(LISTING_CERTIFICATION_DOCS_BUCKET).remove([path]);
}

/**
 * Génère une URL signée temporaire vers un justificatif — le bucket est privé, seul l'admin
 * (modération) doit pouvoir consulter ce document, jamais exposé publiquement.
 */
export async function getCertificationDocumentUrl(path: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(LISTING_CERTIFICATION_DOCS_BUCKET)
    .createSignedUrl(path, 60); // 60s — juste le temps d'ouvrir le lien depuis /admin/logements

  if (error) return null;
  return data.signedUrl;
}
