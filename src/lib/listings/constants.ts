// Constantes partagées client/serveur — ne rien importer ici qui dépende de variables
// d'environnement serveur (voir src/lib/listings/storage.ts pour la logique d'upload).

export const LISTING_PHOTOS_BUCKET = 'listing-photos';
export const MAX_LISTING_PHOTOS = 4;
export const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024; // 5MB, cohérent avec la limite du bucket
export const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

// Justificatif de domicile (facture EDF, internet...) — optionnel, conditionne la pastille
// "hôte certifié" (voir dbshema.md §4.8). Bucket privé, contrairement aux photos.
export const LISTING_CERTIFICATION_DOCS_BUCKET = 'listing-certification-docs';
export const MAX_CERTIFICATION_DOC_SIZE_BYTES = 5 * 1024 * 1024; // 5MB, cohérent avec la limite du bucket
export const ALLOWED_CERTIFICATION_DOC_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const;

export const LISTING_TYPE_LABELS: Record<string, string> = {
  entire_place: 'Logement entier',
  private_room: 'Chambre privée',
  camping_spot: 'Camping / emplacement',
  glamping: 'Glamping / tente équipée',
  couch: 'Canapé',
};
