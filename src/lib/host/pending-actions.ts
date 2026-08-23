import { and, count, eq } from 'drizzle-orm';

import { db } from '@/db/client';
import { bookings, listingFestivals, listings } from '@/db/schema';

export type HostPendingActions = {
  /** Le logement de l'hôte est en attente de validation (création ou modification). */
  listingPendingReview: boolean;
  /** Nombre de demandes de mise en relation en attente de réponse sur son logement. */
  pendingBookingRequestsCount: number;
};

/**
 * Points nécessitant l'attention de l'hôte, affichés via une pastille rouge sur "Mon compte"
 * (header) puis sur le lien concerné ("Mon logement" / "Demandes reçues sur mon logement",
 * voir compte/page.tsx) — pas une notification persistée, recalculé à chaque affichage.
 */
export async function getHostPendingActions(userId: string): Promise<HostPendingActions> {
  const [myListing] = await db
    .select({ status: listings.status })
    .from(listings)
    .where(eq(listings.hostId, userId))
    .limit(1);

  const [row] = await db
    .select({ value: count() })
    .from(bookings)
    .innerJoin(listingFestivals, eq(listingFestivals.id, bookings.listingFestivalId))
    .innerJoin(listings, eq(listings.id, listingFestivals.listingId))
    .where(and(eq(listings.hostId, userId), eq(bookings.status, 'pending')));

  return {
    listingPendingReview: myListing?.status === 'pending_review',
    pendingBookingRequestsCount: row?.value ?? 0,
  };
}
