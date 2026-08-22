import { and, asc, eq, gte, inArray, lte, or } from 'drizzle-orm';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { db } from '@/db/client';
import {
  bookings,
  festivals,
  listingFestivals,
  listingPhotos,
  listingTypeEnum,
  listings,
} from '@/db/schema';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { ListingCard } from '@/components/listings/ListingCard';
import { isFullyBooked } from '@/lib/bookings/availability';
import { LISTING_TYPE_LABELS } from '@/lib/listings/constants';
import { createClient } from '@/lib/supabase/server';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const [festival] = await db
    .select({ name: festivals.name })
    .from(festivals)
    .where(and(eq(festivals.slug, slug), eq(festivals.status, 'published')))
    .limit(1);

  return { title: festival?.name ?? 'Festival' };
}

const dateFormatter = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

type SearchParams = {
  type?: string;
  guests?: string;
  price?: string;
  shuttle?: string;
};

export default async function FestivalDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/connexion');
  }

  const { slug } = await params;
  const [festival] = await db
    .select()
    .from(festivals)
    .where(and(eq(festivals.slug, slug), eq(festivals.status, 'published')))
    .limit(1);

  if (!festival) {
    notFound();
  }

  const filters = await searchParams;

  const typeFilter =
    filters.type && (listingTypeEnum.enumValues as readonly string[]).includes(filters.type)
      ? (filters.type as (typeof listingTypeEnum.enumValues)[number])
      : undefined;
  const guestsFilter = filters.guests ? Number(filters.guests) : null;
  const priceFilter = filters.price ? Number(filters.price) : null;
  const shuttleOnly = filters.shuttle === 'on';

  const conditions = [
    eq(listingFestivals.festivalId, festival.id),
    eq(listings.status, 'published'),
  ];

  if (typeFilter) {
    conditions.push(eq(listings.type, typeFilter));
  }
  // Filtre borné à 1-10 personnes — cohérent avec les bornes min/max du champ ; revalidé ici
  // car un min/max HTML n'est qu'une suggestion au navigateur, pas une garantie contre une
  // requête forgée directement (query string modifiée à la main).
  if (guestsFilter && Number.isFinite(guestsFilter) && guestsFilter >= 1 && guestsFilter <= 10) {
    conditions.push(
      or(gte(listings.maxGuests, guestsFilter), gte(listings.spotsTotal, guestsFilter))!
    );
  }
  if (priceFilter !== null && Number.isFinite(priceFilter) && priceFilter > 0) {
    conditions.push(lte(listings.pricePerNight, priceFilter.toFixed(2)));
  }
  if (shuttleOnly) {
    conditions.push(eq(listingFestivals.hasShuttle, true));
  }

  const rows = await db
    .select({
      listing: listings,
      listingFestivalId: listingFestivals.id,
      spotsAvailable: listingFestivals.spotsAvailable,
      distanceKm: listingFestivals.distanceKm,
      hasShuttle: listingFestivals.hasShuttle,
      shuttleCost: listingFestivals.shuttleCost,
    })
    .from(listingFestivals)
    .innerJoin(listings, eq(listings.id, listingFestivals.listingId))
    .where(and(...conditions))
    .orderBy(asc(listings.pricePerNight));

  const listingIds = rows.map((row) => row.listing.id);
  const firstPhotoByListingId = new Map<string, string>();
  if (listingIds.length > 0) {
    const photos = await db
      .select()
      .from(listingPhotos)
      .where(inArray(listingPhotos.listingId, listingIds))
      .orderBy(asc(listingPhotos.position));
    for (const photo of photos) {
      if (!firstPhotoByListingId.has(photo.listingId)) {
        firstPhotoByListingId.set(photo.listingId, photo.url);
      }
    }
  }

  // Statut de mise en relation par logement : "déjà réservé" (complet, tous
  // festivaliers confondus) prime sur "en attente de réponse" (demande pending
  // du festivalier courant). Deux requêtes groupées plutôt qu'une par logement.
  const listingFestivalIds = rows.map((row) => row.listingFestivalId);
  const acceptedByListingFestivalId = new Map<
    string,
    { hasAccepted: boolean; spotsBooked: number }
  >();
  const pendingListingFestivalIds = new Set<string>();
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

    const pendingRows = await db
      .select({ listingFestivalId: bookings.listingFestivalId })
      .from(bookings)
      .where(
        and(
          inArray(bookings.listingFestivalId, listingFestivalIds),
          eq(bookings.status, 'pending'),
          eq(bookings.guestId, user.id)
        )
      );
    for (const b of pendingRows) pendingListingFestivalIds.add(b.listingFestivalId);
  }

  function bookingStatusFor(row: (typeof rows)[number]): 'reserved' | 'pending' | null {
    const accepted = acceptedByListingFestivalId.get(row.listingFestivalId);
    const reserved = isFullyBooked({
      listingType: row.listing.type,
      spotsTotal: row.listing.spotsTotal,
      spotsAvailable: row.spotsAvailable,
      hasAcceptedBooking: accepted?.hasAccepted ?? false,
      acceptedSpotsBooked: accepted?.spotsBooked ?? 0,
    });
    if (reserved) return 'reserved';
    if (pendingListingFestivalIds.has(row.listingFestivalId)) return 'pending';
    return null;
  }

  const hasActiveFilters = Boolean(typeFilter || guestsFilter || priceFilter || shuttleOnly);
  const inputClass =
    'mt-1 w-full rounded border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-700 dark:bg-transparent';

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <Breadcrumbs items={[{ label: festival.name }]} />
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:underline"
      >
        ← Retour aux festivals
      </Link>
      <h1 className="mt-4 text-2xl font-semibold">{festival.name}</h1>
      <p className="mt-2 text-gray-500">
        {festival.city}, {festival.country} · {dateFormatter.format(festival.dateStart)} –{' '}
        {dateFormatter.format(festival.dateEnd)}
      </p>

      {festival.description && (
        <p className="mt-4 whitespace-pre-line">
          {festival.description}
        </p>
      )}

      <form
        method="get"
        aria-label="Filtrer les logements"
        className="mt-6 grid grid-cols-1 gap-3 rounded-lg border border-gray-200 p-4 sm:grid-cols-5 dark:border-gray-800"
      >
        <div>
          <label htmlFor="type" className="block text-sm font-medium">
            Type
          </label>
          <select id="type" name="type" defaultValue={typeFilter ?? ''} className={inputClass}>
            <option value="">Tous</option>
            {listingTypeEnum.enumValues.map((value) => (
              <option key={value} value={value}>
                {LISTING_TYPE_LABELS[value] ?? value}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="guests" className="block text-sm font-medium">
            Nombre de personnes
          </label>
          <input
            id="guests"
            name="guests"
            type="number"
            min={1}
            max={10}
            defaultValue={filters.guests ?? '1'}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="price" className="block text-sm font-medium">
            Prix maximum (€ / nuit)
          </label>
          <input
            id="price"
            name="price"
            type="number"
            min={0}
            step="0.01"
            defaultValue={filters.price ?? ''}
            className={inputClass}
          />
        </div>
        <div className="flex items-end gap-2 pb-1.5">
          <input
            id="shuttle"
            name="shuttle"
            type="checkbox"
            defaultChecked={shuttleOnly}
            className="h-4 w-4"
          />
          <label htmlFor="shuttle" className="text-sm">
            Navette disponible
          </label>
        </div>
        <div className="flex items-end justify-end gap-3">
          <button
            type="submit"
            className="rounded bg-gray-900 px-4 py-1.5 text-sm font-medium text-white dark:bg-white dark:text-gray-900"
          >
            Filtrer
          </button>
          {hasActiveFilters && (
            <Link href={`/festivals/${festival.slug}`} className="text-sm text-gray-500 underline">
              Réinitialiser
            </Link>
          )}
        </div>
      </form>

      {rows.length === 0 ? (
        <p className="mt-8 text-sm text-gray-500">
          {hasActiveFilters
            ? 'Aucun logement ne correspond à ces filtres.'
            : 'Aucun logement disponible pour ce festival pour le moment.'}
        </p>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((row) => (
            <ListingCard
              key={row.listing.id}
              listing={row.listing}
              photoUrl={firstPhotoByListingId.get(row.listing.id) ?? null}
              distanceKm={row.distanceKm}
              hasShuttle={row.hasShuttle}
              shuttleCost={row.shuttleCost}
              bookingStatus={bookingStatusFor(row)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
