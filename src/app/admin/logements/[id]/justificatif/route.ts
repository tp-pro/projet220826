import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { NextResponse } from 'next/server';

import { db } from '@/db/client';
import { listings } from '@/db/schema';
import { requireAdmin } from '@/lib/auth/admin';
import { getCertificationDocumentUrl } from '@/lib/listings/storage';

/**
 * Redirige vers une URL signée générée à l'instant, plutôt que d'en pré-générer une au rendu
 * de `/admin/logements` : une URL signée expire vite (60s, voir `getCertificationDocumentUrl`)
 * et le délai entre le rendu de la page et le clic de l'admin la rendait quasi systématiquement
 * périmée ("InvalidJWT / exp claim timestamp check failed"). Générée ici, au moment du clic,
 * elle est toujours fraîche.
 *
 * ⚠️ Un Route Handler n'hérite pas de la protection de `admin/layout.tsx` (qui ne s'applique
 * qu'aux pages) — `requireAdmin()` doit être appelé explicitement, même règle que pour les
 * Server Actions (voir `src/lib/auth/admin.ts`).
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();

  const { id } = await params;
  const [listing] = await db
    .select({ certificationDocumentPath: listings.certificationDocumentPath })
    .from(listings)
    .where(eq(listings.id, id))
    .limit(1);

  if (!listing?.certificationDocumentPath) {
    notFound();
  }

  const signedUrl = await getCertificationDocumentUrl(listing.certificationDocumentPath);
  if (!signedUrl) {
    return new NextResponse('Justificatif indisponible pour le moment — réessaie.', {
      status: 502,
    });
  }

  return NextResponse.redirect(signedUrl);
}
