// Constantes partagées client/serveur — même convention que src/lib/listings/constants.ts et
// src/lib/festivals/constants.ts : ne rien importer ici qui dépende de variables
// d'environnement serveur (voir storage.ts pour la logique d'upload).

export const AVATARS_BUCKET = 'avatars';
export const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024; // 5MB, cohérent avec la limite du bucket
export const ALLOWED_AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
