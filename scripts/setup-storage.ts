/**
 * Provisionne les buckets Supabase Storage utilisés par l'app (photos de logement, images
 * de couverture de festival). Idempotent : ignore les buckets déjà présents.
 *
 * Usage : npm run storage:setup
 */
import { FESTIVAL_COVERS_BUCKET } from '../src/lib/festivals/constants';
import {
  ALLOWED_CERTIFICATION_DOC_TYPES,
  LISTING_CERTIFICATION_DOCS_BUCKET,
  LISTING_PHOTOS_BUCKET,
} from '../src/lib/listings/constants';
import { AVATARS_BUCKET } from '../src/lib/profile/constants';
import { createAdminClient } from '../src/lib/supabase/admin';

const BUCKETS = [
  { name: LISTING_PHOTOS_BUCKET, label: 'photos de logement', public: true },
  { name: FESTIVAL_COVERS_BUCKET, label: 'images de couverture de festival', public: true },
  { name: AVATARS_BUCKET, label: 'photos de profil', public: true },
  {
    name: LISTING_CERTIFICATION_DOCS_BUCKET,
    label: 'justificatifs de domicile hôte',
    public: false, // privé — données personnelles, accès via URL signée uniquement (modération admin)
    allowedMimeTypes: ALLOWED_CERTIFICATION_DOC_TYPES as unknown as string[],
  },
] as const;

async function main() {
  const admin = createAdminClient();

  const { data: existing, error: listError } = await admin.storage.listBuckets();
  if (listError) {
    throw new Error(`Impossible de lister les buckets : ${listError.message}`);
  }
  const existingNames = new Set(existing.map((bucket) => bucket.name));

  for (const bucket of BUCKETS) {
    const { name, label, public: isPublic } = bucket;
    if (existingNames.has(name)) {
      console.log(`→ Bucket "${name}" (${label}) déjà présent, rien à faire.`);
      continue;
    }

    const allowedMimeTypes =
      'allowedMimeTypes' in bucket
        ? bucket.allowedMimeTypes
        : ['image/jpeg', 'image/png', 'image/webp'];

    const { error } = await admin.storage.createBucket(name, {
      public: isPublic,
      fileSizeLimit: '5MB',
      allowedMimeTypes,
    });

    if (error) {
      throw new Error(`Échec de création du bucket "${name}" : ${error.message}`);
    }

    console.log(
      `✅ Bucket "${name}" (${label}) créé (${isPublic ? 'public' : 'privé'}, 5MB max, ${allowedMimeTypes.join('/')}).`
    );
  }
}

main().catch((err) => {
  console.error('❌', err);
  process.exitCode = 1;
});
