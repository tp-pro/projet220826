import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Relevé au-delà du défaut (~1MB) pour permettre l'upload de jusqu'à 4 photos
      // de logement via Server Action (voir src/lib/listings/actions.ts).
      bodySizeLimit: '10mb',
    },
  },
};

export default nextConfig;
