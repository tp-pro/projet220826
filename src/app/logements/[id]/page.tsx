import { and, asc, eq, sql } from 'drizzle-orm';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { db } from '@/db/client';
import { bookings, festivals, listingFestivals, listingPhotos, listings, users } from '@/db/schema';
import { RequestBookingForm } from '@/components/bookings/RequestBookingForm';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { expireOverdueAcceptedBookings } from '@/lib/bookings/actions';
import { isFullyBooked } from '@/lib/bookings/availability';
import { LISTING_TYPE_LABELS } from '@/lib/listings/constants';
import { getFirstName } from '@/lib/profile/utils';
import { createClient } from '@/lib/supabase/server';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const [listing] = await db
    .select({ title: listings.title })
    .from(listings)
    .where(and(eq(listings.id, id), eq(listings.status, 'published')))
    .limit(1);

  return { title: listing?.title ?? 'Logement' };
}

const dateFormatter = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

/** Fenêtre de séjour autorisée = dates du festival ± buffer arrivée (voir dbshema.md §3.6/§3.5). */
function bookingWindow(
  festival: { dateStart: Date; dateEnd: Date },
  bufferBefore: number,
  bufferAfter: number
) {
  const minDate = new Date(festival.dateStart);
  minDate.setDate(minDate.getDate() - bufferBefore);
  const maxDate = new Date(festival.dateEnd);
  maxDate.setDate(maxDate.getDate() + bufferAfter);
  return { minDate: toDateInputValue(minDate), maxDate: toDateInputValue(maxDate) };
}

const BOOKING_STATUS_LABELS: Record<string, string> = {
  pending: "Demande envoyée, en attente de réponse de l'hôte.",
  accepted: "Demande acceptée ! L'hôte va te contacter.",
  rejected: 'Demande refusée.',
  cancelled: 'Demande annulée.',
};

function formatCapacity(listing: {
  minGuests: number | null;
  maxGuests: number | null;
  spotsTotal: number | null;
}) {
  if (listing.maxGuests) {
    // `minGuests` absent sur les logements créés avant son ajout (colonne nullable, pas de
    // backfill) — repli sur l'ancien libellé "maximum" seul dans ce cas.
    return listing.minGuests
      ? `${listing.minGuests} à ${listing.maxGuests} voyageurs`
      : `${listing.maxGuests} voyageur${listing.maxGuests > 1 ? 's' : ''} maximum`;
  }
  if (listing.spotsTotal) {
    return `${listing.spotsTotal} place${listing.spotsTotal > 1 ? 's' : ''} disponible${listing.spotsTotal > 1 ? 's' : ''}`;
  }
  return null;
}

export default async function ListingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/connexion');
  }

  // Pas de tâche planifiée dans ce projet — balayage paresseux avant de lire le statut de
  // réservation, pour qu'une demande `accepted` expirée (délai de 48h dépassé sans email
  // partagé, booking-requests-setup.md §18) ne bloque plus artificiellement la disponibilité
  // affichée à un autre festivalier.
  await expireOverdueAcceptedBookings();

  const { id } = await params;

  const [row] = await db
    .select({
      listing: listings,
      host: users,
      festival: festivals,
      listingFestivalId: listingFestivals.id,
      spotsAvailable: listingFestivals.spotsAvailable,
      distanceKm: listingFestivals.distanceKm,
      hasShuttle: listingFestivals.hasShuttle,
      shuttleCost: listingFestivals.shuttleCost,
      arrivalBufferBefore: listingFestivals.arrivalBufferBefore,
      arrivalBufferAfter: listingFestivals.arrivalBufferAfter,
    })
    .from(listings)
    .innerJoin(users, eq(users.id, listings.hostId))
    .leftJoin(listingFestivals, eq(listingFestivals.listingId, listings.id))
    .leftJoin(festivals, eq(festivals.id, listingFestivals.festivalId))
    .where(eq(listings.id, id))
    .limit(1);

  if (!row || row.listing.status !== 'published') {
    notFound();
  }

  const {
    listing,
    host,
    festival,
    listingFestivalId,
    spotsAvailable,
    distanceKm,
    hasShuttle,
    shuttleCost,
    arrivalBufferBefore,
    arrivalBufferAfter,
  } = row;

  const photos = await db
    .select()
    .from(listingPhotos)
    .where(eq(listingPhotos.listingId, listing.id))
    .orderBy(asc(listingPhotos.position));

  const isOwnListing = listing.hostId === user.id;
  let existingBooking: { status: string; rejectionReason: string | null } | null = null;
  let reserved = false;
  if (!isOwnListing && listingFestivalId) {
    const [booking] = await db
      .select({ status: bookings.status, rejectionReason: bookings.rejectionReason })
      .from(bookings)
      .where(and(eq(bookings.listingFestivalId, listingFestivalId), eq(bookings.guestId, user.id)))
      .limit(1);
    existingBooking = booking ?? null;

    // Pas de demande en cours pour l'utilisateur courant : vérifier si un autre
    // festivalier a déjà rempli ce logement, pour ne pas proposer un formulaire
    // de demande sur un logement devenu indisponible (voir dbshema.md §4.4).
    if (!existingBooking) {
      const [{ hasAccepted, totalSpotsBooked }] = await db
        .select({
          hasAccepted: sql<boolean>`coalesce(bool_or(${bookings.status} = 'accepted'), false)`,
          totalSpotsBooked: sql<number>`coalesce(sum(${bookings.spotsBooked}) filter (where ${bookings.status} = 'accepted'), 0)`,
        })
        .from(bookings)
        .where(eq(bookings.listingFestivalId, listingFestivalId));

      reserved = isFullyBooked({
        listingType: listing.type,
        spotsTotal: listing.spotsTotal,
        spotsAvailable,
        hasAcceptedBooking: hasAccepted,
        acceptedSpotsBooked: Number(totalSpotsBooked),
      });
    }
  }

  const capacity = formatCapacity(listing);
  const amenities = Array.isArray(listing.amenities) ? (listing.amenities as string[]) : [];

  // `festival` est garanti non-null dès lors que `listingFestivalId` l'est : `listing_festivals`
  // a une FK `festival_id` NOT NULL (voir schema.ts) — le `leftJoin` est juste un style de
  // requête, pas un signe qu'un logement associé peut se retrouver sans festival.
  const { minDate: bookingMinDate, maxDate: bookingMaxDate } = festival
    ? bookingWindow(festival, arrivalBufferBefore ?? 1, arrivalBufferAfter ?? 1)
    : { minDate: '', maxDate: '' };

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <Breadcrumbs
        items={[
          ...(festival ? [{ label: festival.name, href: `/festivals/${festival.slug}` }] : []),
          { label: listing.title },
        ]}
      />
      <Link
        href={festival ? `/festivals/${festival.slug}` : '/'}
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:underline"
      >
        ← Retour {festival ? `à ${festival.name}` : 'aux festivals'}
      </Link>

      {photos.length > 0 && (
        <div className="mt-4 grid grid-cols-2 gap-2">
          {photos.map((photo, index) => (
            // eslint-disable-next-line @next/next/no-img-element -- URLs Supabase Storage, pas de config remotePatterns pour l'instant
            <img
              key={photo.id}
              src={photo.url}
              alt={`Photo ${index + 1} sur ${photos.length} — ${listing.title}`}
              className="h-48 w-full rounded-lg object-cover"
            />
          ))}
        </div>
      )}

      <h1 className="mt-6 text-2xl font-semibold">{listing.title}</h1>
      <p className="mt-1 text-gray-500">
        {listing.address ? `${listing.address}, ` : ''}
        {listing.city}, {listing.country}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-gray-200 px-2 py-0.5 text-xs dark:border-gray-700">
          {LISTING_TYPE_LABELS[listing.type] ?? listing.type}
        </span>
        {capacity && <span className="text-sm">{capacity}</span>}
        {listing.certificationDocumentPath && (
          <span className="rounded-full border border-green-300 bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-300">
            Hôte certifié
          </span>
        )}
      </div>

      <p className="mt-4 text-xl font-semibold">
        {listing.pricePerNight} €{' '}
        <span className="text-base font-normal text-gray-500">/ nuit / voyageur</span>
      </p>

      {listing.description && (
        <p className="mt-4 text-sm whitespace-pre-line">{listing.description}</p>
      )}

      {amenities.length > 0 && (
        <div className="mt-6">
          <h2 className="text-sm font-semibold">Équipements</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {amenities.map((amenity) => (
              <span
                key={amenity}
                className="rounded-full border border-gray-200 px-2 py-0.5 text-xs dark:border-gray-700"
              >
                {amenity}
              </span>
            ))}
          </div>
        </div>
      )}

      {festival && (
        <div className="mt-6 rounded-lg border border-gray-200 p-4 dark:border-gray-800">
          <h2 className="text-sm font-semibold">Festival</h2>
          <p className="mt-1 text-sm text-gray-500">
            <Link href={`/festivals/${festival.slug}`} className="underline">
              {festival.name}
            </Link>{' '}
            · {festival.city}, {festival.country} · {dateFormatter.format(festival.dateStart)} –{' '}
            {dateFormatter.format(festival.dateEnd)}
          </p>
          {(distanceKm || hasShuttle) && (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              {distanceKm && <span>{distanceKm} km du festival</span>}
              {hasShuttle && (
                <span className="rounded-full border border-gray-200 px-2 py-0.5 dark:border-gray-700">
                  Navette{' '}
                  {shuttleCost && Number(shuttleCost) > 0 ? `(+${shuttleCost} €)` : 'incluse'}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      <div className="mt-6 rounded-lg border border-gray-200 p-4 dark:border-gray-800">
        <div className="flex items-center gap-3">
          {host.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- URL Supabase Storage, pas de config remotePatterns pour l'instant
            <img src={host.avatarUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
          ) : (
            <div
              aria-hidden="true"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200 text-sm font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400"
            >
              {getFirstName(host.fullName).charAt(0).toUpperCase()}
            </div>
          )}
          <h2 className="text-sm font-semibold">Hébergé par {getFirstName(host.fullName)}</h2>
        </div>
        {host.bio && <p className="mt-2 text-sm text-gray-500">{host.bio}</p>}
        <p className="mt-2 text-xs">
          Pour préserver la confidentialité, les coordonnées de l&apos;hôte ne sont partagées
          qu&apos;après acceptation d&apos;une demande de mise en relation.
        </p>
      </div>

      {!isOwnListing && listingFestivalId && (
        <div className="mt-6">
          {existingBooking ? (
            <p className="rounded border border-border bg-surface px-4 py-3 text-sm text-ink">
              {BOOKING_STATUS_LABELS[existingBooking.status] ?? existingBooking.status}
              {existingBooking.status === 'rejected' && existingBooking.rejectionReason && (
                <span className="mt-1 block text-muted">
                  Motif : {existingBooking.rejectionReason}
                </span>
              )}
              {existingBooking.status === 'cancelled' && existingBooking.rejectionReason && (
                <span className="mt-1 block text-muted">{existingBooking.rejectionReason}</span>
              )}
            </p>
          ) : reserved ? (
            <p className="rounded border border-danger/40 bg-danger/15 px-4 py-3 text-sm font-medium text-danger">
              Déjà réservé — ce logement n&apos;est plus disponible pour ce festival.
            </p>
          ) : (
            <RequestBookingForm
              listingFestivalId={listingFestivalId}
              minDate={bookingMinDate}
              maxDate={bookingMaxDate}
              minGuests={listing.minGuests}
              maxGuests={listing.maxGuests ?? listing.spotsTotal}
            />
          )}
        </div>
      )}
    </div>
  );
}
