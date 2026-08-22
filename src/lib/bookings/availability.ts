import { BLOCKING_LISTING_TYPES } from '@/db/schema';

/**
 * Un logement "bloquant" (entire_place, private_room) est complet dès qu'une
 * demande `accepted` existe pour ce festival. Un logement "à places" est complet
 * quand la somme des places acceptées atteint la capacité (spots_available,
 * fallback spots_total). Voir dbshema.md §4.4 et les invariants documentés sur
 * `bookings` dans src/db/schema.ts (même règle que `acceptBookingAction`).
 */
export function isFullyBooked({
  listingType,
  spotsTotal,
  spotsAvailable,
  hasAcceptedBooking,
  acceptedSpotsBooked,
}: {
  listingType: string;
  spotsTotal: number | null;
  spotsAvailable: number | null;
  hasAcceptedBooking: boolean;
  acceptedSpotsBooked: number;
}): boolean {
  const isBlocking = (BLOCKING_LISTING_TYPES as readonly string[]).includes(listingType);
  if (isBlocking) return hasAcceptedBooking;

  const capacity = spotsAvailable ?? spotsTotal ?? 0;
  return capacity > 0 && acceptedSpotsBooked >= capacity;
}

/** Fenêtre de partage de l'email du festivalier après acceptation (booking-requests-setup.md §15/§16). */
export const EMAIL_SHARE_WINDOW_HOURS = 48;

/**
 * Le festivalier dispose de `EMAIL_SHARE_WINDOW_HOURS` à partir de l'acceptation de sa demande
 * (`bookings.responded_at`) pour partager son email avec l'hôte — passé ce délai, l'action n'est
 * plus proposée. Partagée entre l'action serveur (`shareGuestEmailAction`, revalidation stricte,
 * jamais fait confiance à l'horloge du client) et la page /mes-demandes (savoir s'il faut
 * afficher le bouton ou un message d'expiration).
 */
export function isEmailShareWindowOpen(respondedAt: Date | null): boolean {
  if (!respondedAt) return false;
  const windowMs = EMAIL_SHARE_WINDOW_HOURS * 60 * 60 * 1000;
  return Date.now() - respondedAt.getTime() <= windowMs;
}
