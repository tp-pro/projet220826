import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import { env } from '@/config/env';

import * as schema from './schema';

declare global {
  var __pgClient: ReturnType<typeof postgres> | undefined;
}

// En dev, Turbopack/Next.js réévalue ce module à chaque hot-reload d'un fichier qui l'importe
// (même transitivement). Sans mémorisation, ça recrée une connexion Postgres à chaque
// modification de fichier sans jamais fermer les précédentes, jusqu'à épuiser le quota de
// connexions (particulièrement bas sur le plan gratuit Supabase). On mémorise donc le client
// sur `globalThis`, préservé entre les hot-reloads — uniquement en dehors de la prod, où chaque
// process ne doit de toute façon créer qu'une seule instance.
const client = globalThis.__pgClient ?? postgres(env.DATABASE_URL, { prepare: false });

if (env.NODE_ENV !== 'production') {
  globalThis.__pgClient = client;
}

export const db = drizzle(client, { schema });

/**
 * Ferme le pool de connexions Postgres. À appeler uniquement en fin de script one-shot
 * (seed, migration manuelle...) — jamais dans le runtime Next.js, où la connexion doit
 * rester ouverte entre les requêtes.
 */
export function closeDb() {
  return client.end();
}
