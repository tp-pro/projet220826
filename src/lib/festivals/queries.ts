import { and, asc, eq, inArray } from 'drizzle-orm';

import { db } from '@/db/client';
import { bookings, festivals, listingFestivals, listings } from '@/db/schema';
import { isFullyBooked } from '@/lib/bookings/availability';

/**
 * Festivals publiés + nombre de logements réellement disponibles par festival (publiés, actifs,
 * pas complets — voir lib/bookings/availability.ts) — factorisé ici pour être partagé entre la
 * page d'accueil et les pages par catégorie (`/festivals/musique`, `/festivals/litteraire`), qui
 * affichent toutes le même `FestivalCard` avec le même calcul de disponibilité.
 */
export async function getPublishedFestivalsWithListingCounts() {
  const [publishedFestivals, listingFestivalRows] = await Promise.all([
    db
      .select()
      .from(festivals)
      .where(eq(festivals.status, 'published'))
      .orderBy(asc(festivals.name)),
    // Un logement par festival, tous types confondus (entier, chambre, camping...) — ne retient
    // que les logements publiés et les associations actives, cohérent avec ce qui est réellement
    // visible publiquement. Le statut de réservation est résolu ensuite pour exclure du compteur
    // les logements déjà complets.
    db
      .select({
        festivalId: listingFestivals.festivalId,
        listingFestivalId: listingFestivals.id,
        listingType: listings.type,
        spotsTotal: listings.spotsTotal,
        spotsAvailable: listingFestivals.spotsAvailable,
      })
      .from(listingFestivals)
      .innerJoin(listings, eq(listings.id, listingFestivals.listingId))
      .where(and(eq(listings.status, 'published'), eq(listingFestivals.isActive, true))),
  ]);

  const listingFestivalIds = listingFestivalRows.map((row) => row.listingFestivalId);
  const acceptedByListingFestivalId = new Map<
    string,
    { hasAccepted: boolean; spotsBooked: number }
  >();
  if (listingFestivalIds.length > 0) {
    const acceptedRows = await db
      .select({ listingFestivalId: bookings.listingFestivalId, spotsBooked: bookings.spotsBooked })
      .from(bookings)
      .where(
        and(
          inArray(bookings.listingFestivalId, listingFestivalIds),
          eq(bookings.status, 'accepted')
        )
      );
    for (const b of acceptedRows) {
      const entry = acceptedByListingFestivalId.get(b.listingFestivalId) ?? {
        hasAccepted: false,
        spotsBooked: 0,
      };
      entry.hasAccepted = true;
      entry.spotsBooked += b.spotsBooked;
      acceptedByListingFestivalId.set(b.listingFestivalId, entry);
    }
  }

  const listingCountByFestivalId = new Map<string, number>();
  for (const row of listingFestivalRows) {
    const accepted = acceptedByListingFestivalId.get(row.listingFestivalId);
    const reserved = isFullyBooked({
      listingType: row.listingType,
      spotsTotal: row.spotsTotal,
      spotsAvailable: row.spotsAvailable,
      hasAcceptedBooking: accepted?.hasAccepted ?? false,
      acceptedSpotsBooked: accepted?.spotsBooked ?? 0,
    });
    if (!reserved) {
      listingCountByFestivalId.set(
        row.festivalId,
        (listingCountByFestivalId.get(row.festivalId) ?? 0) + 1
      );
    }
  }

  return { festivals: publishedFestivals, listingCountByFestivalId };
}
