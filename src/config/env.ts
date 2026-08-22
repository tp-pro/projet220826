import { createEnv } from '@t3-oss/env-nextjs';
import * as z from 'zod';

export const env = createEnv({
  server: {
    // Exemple — à adapter selon vos besoins réels de projet
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    // Connexion Postgres (Supabase) — voir /dbshema.md pour le schéma complet
    DATABASE_URL: z.string().startsWith('postgres'),
    // Clé admin Supabase — bypass RLS, utilisée UNIQUEMENT côté serveur (seed, tâches admin).
    // Ne jamais préfixer NEXT_PUBLIC_, ne jamais importer depuis un composant client.
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  },
  client: {
    NEXT_PUBLIC_APP_URL: z.url(),
    NEXT_PUBLIC_SUPABASE_URL: z.url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  },
  experimental__runtimeEnv: {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    // NODE_ENV: process.env.NODE_ENV, retiré : c'est une variable serveur, elle est lue automatiquement en interne
  },
});
