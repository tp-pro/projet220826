// Constantes partagées client/serveur — même convention que src/lib/listings/constants.ts :
// ne rien importer ici qui dépende de variables d'environnement serveur (voir storage.ts).

export const FESTIVAL_COVERS_BUCKET = 'festival-covers';
export const MAX_COVER_SIZE_BYTES = 5 * 1024 * 1024; // 5MB, cohérent avec la limite du bucket
export const ALLOWED_COVER_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

// Catégories fixes de festival — doit rester synchronisé avec `festivalCategoryEnum` dans
// src/db/schema.ts (dupliqué ici plutôt qu'importé, pour ne pas faire dépendre les composants
// client de drizzle-orm/pg-core ; la Server Action valide de toute façon contre l'enum réel).
export const FESTIVAL_CATEGORIES = ['musique', 'litteraire', 'evenementiel', 'culturel'] as const;

// Libellés FR correspondants — même convention que LISTING_TYPE_LABELS dans
// src/lib/listings/constants.ts.
export const FESTIVAL_CATEGORY_LABELS: Record<string, string> = {
  musique: 'Musique',
  litteraire: 'Littéraire',
  evenementiel: 'Événementiel',
  culturel: 'Culturel',
};
