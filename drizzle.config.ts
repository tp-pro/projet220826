import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

config({
  path: process.env.ENV_FILE || '.env.local',
});

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL manquant');
}

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',

  dbCredentials: {
    url: process.env.DATABASE_URL,
  },

  strict: true,
  verbose: true,
});