import { asc, desc, eq, inArray } from 'drizzle-orm';
import type { Metadata } from 'next';
import Link from 'next/link';

import { db } from '@/db/client';
import {
  festivals,
  listingFestivals,
  listingPhotos,
  listings,
  listingStatusEnum,
  users,
} from '@/db/schema';
import { approveListingAction, rejectListingAction } from '@/lib/admin/listings-actions';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { LISTING_TYPE_LABELS } from '@/lib/listings/constants';

const PAGE_TITLE = 'Modération des logements';

export const metadata: Metadata = { title: PAGE_TITLE };

const STATUS_LABELS: Record<(typeof listingStatusEnum.enumValues)[number], string> = {
  draft: 'Brouillon',
  pending_review: 'En attente',
  published: 'Publié',
  rejected: 'Refusé',
  archived: 'Archivé',
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

export default async function AdminListingsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const statusFilter =
    status && (listingStatusEnum.enumValues as readonly string[]).includes(status)
      ? (status as (typeof listingStatusEnum.enumValues)[number])
      : undefined;

  const rows = await db
    .select({
      listing: listings,
      hostName: users.fullName,
      hostEmail: users.email,
    })
    .from(listings)
    .innerJoin(users, eq(users.id, listings.hostId))
    .where(statusFilter ? eq(listings.status, statusFilter) : undefined)
    .orderBy(desc(listings.createdAt));

  const listingIds = rows.map((r) => r.listing.id);

  // Photos et association festival — pour que l'admin voie la fiche telle qu'elle sera
  // publiée (y compris après une modification par l'hôte, cf. dbshema.md §4.3), pas
  // seulement le résumé minimal affiché jusqu'ici.
  const photos =
    listingIds.length > 0
      ? await db
          .select({
            id: listingPhotos.id,
            listingId: listingPhotos.listingId,
            url: listingPhotos.url,
          })
          .from(listingPhotos)
          .where(inArray(listingPhotos.listingId, listingIds))
          .orderBy(asc(listingPhotos.position))
      : [];
  const photosByListingId = new Map<string, typeof photos>();
  for (const photo of photos) {
    const existing = photosByListingId.get(photo.listingId) ?? [];
    existing.push(photo);
    photosByListingId.set(photo.listingId, existing);
  }

  const festivalAssociations =
    listingIds.length > 0
      ? await db
          .select({
            listingId: listingFestivals.listingId,
            festivalName: festivals.name,
            festivalCity: festivals.city,
            festivalCountry: festivals.country,
            distanceKm: listingFestivals.distanceKm,
            hasShuttle: listingFestivals.hasShuttle,
            shuttleCost: listingFestivals.shuttleCost,
            arrivalBufferBefore: listingFestivals.arrivalBufferBefore,
            arrivalBufferAfter: listingFestivals.arrivalBufferAfter,
          })
          .from(listingFestivals)
          .innerJoin(festivals, eq(festivals.id, listingFestivals.festivalId))
          .where(inArray(listingFestivals.listingId, listingIds))
      : [];
  const festivalByListingId = new Map(festivalAssociations.map((f) => [f.listingId, f]));

  return (
    <div>
      <Breadcrumbs
        items={[{ label: 'Administration', href: '/admin/logements' }, { label: PAGE_TITLE }]}
      />
      <div className="flex flex-wrap gap-2 text-sm">
        <Link
          href="/admin/logements"
          className={!statusFilter ? 'font-semibold underline' : 'text-gray-500'}
        >
          Tous
        </Link>
        {listingStatusEnum.enumValues.map((s) => (
          <Link
            key={s}
            href={`/admin/logements?status=${s}`}
            className={statusFilter === s ? 'font-semibold underline' : 'text-gray-500'}
          >
            {STATUS_LABELS[s]}
          </Link>
        ))}
      </div>

      <div className="mt-6 space-y-4">
        {rows.length === 0 && (
          <p className="text-sm text-gray-500">Aucun logement pour ce filtre.</p>
        )}
        {rows.map(({ listing, hostName, hostEmail }) => {
          const listingPhotoList = photosByListingId.get(listing.id) ?? [];
          const festival = festivalByListingId.get(listing.id);
          const capacity = formatCapacity(listing);
          const amenities = Array.isArray(listing.amenities) ? (listing.amenities as string[]) : [];

          return (
            <div
              key={listing.id}
              className="rounded-lg border border-gray-200 p-4 dark:border-gray-800"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{listing.title}</p>
                  <p className="text-sm text-gray-500">
                    {hostName ?? hostEmail} · {LISTING_TYPE_LABELS[listing.type] ?? listing.type}
                  </p>
                </div>
                <span className="rounded-full border border-gray-200 px-2 py-0.5 text-xs dark:border-gray-700">
                  {STATUS_LABELS[listing.status]}
                </span>
              </div>

              {listingPhotoList.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {listingPhotoList.map((photo, index) => (
                    // eslint-disable-next-line @next/next/no-img-element -- URLs Supabase Storage, pas de config remotePatterns pour l'instant
                    <img
                      key={photo.id}
                      src={photo.url}
                      alt={`Photo ${index + 1} — ${listing.title}`}
                      className="h-20 w-28 rounded object-cover"
                    />
                  ))}
                </div>
              )}

              <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-gray-500">Adresse</dt>
                  <dd>
                    {listing.address ? `${listing.address}, ` : ''}
                    {listing.city}, {listing.country}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500">Capacité</dt>
                  <dd>{capacity ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Prix</dt>
                  <dd>{listing.pricePerNight} € / nuit / voyageur</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Festival associé</dt>
                  <dd>
                    {festival ? (
                      <>
                        {festival.festivalName} — {festival.festivalCity},{' '}
                        {festival.festivalCountry}
                        {festival.distanceKm && ` · ${festival.distanceKm} km`}
                        {festival.hasShuttle &&
                          ` · Navette${Number(festival.shuttleCost) > 0 ? ` (+${festival.shuttleCost} €)` : ' incluse'}`}
                        <br />
                        {festival.arrivalBufferBefore > 0 || festival.arrivalBufferAfter > 0
                          ? 'Arrivée la veille et départ le lendemain autorisés'
                          : 'Disponible uniquement pendant les dates du festival'}
                      </>
                    ) : (
                      '—'
                    )}
                  </dd>
                </div>
              </dl>

              {listing.description && (
                <p className="mt-3 text-sm whitespace-pre-line">{listing.description}</p>
              )}

              {amenities.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {amenities.map((amenity) => (
                    <span
                      key={amenity}
                      className="rounded-full border border-gray-200 px-2 py-0.5 text-xs dark:border-gray-700"
                    >
                      {amenity}
                    </span>
                  ))}
                </div>
              )}

              {listing.certificationDocumentPath && (
                <p className="mt-2 text-sm text-green-700 dark:text-green-400">
                  ✓ Justificatif de domicile fourni —{' '}
                  <a
                    href={`/admin/logements/${listing.id}/justificatif`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    consulter
                  </a>
                </p>
              )}

              {listing.status === 'rejected' && listing.rejectionReason && (
                <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                  Motif du refus : {listing.rejectionReason}
                </p>
              )}

              {listing.status === 'pending_review' && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <form action={approveListingAction}>
                    <input type="hidden" name="listingId" value={listing.id} />
                    <button
                      type="submit"
                      className="rounded bg-gray-900 px-3 py-1.5 text-sm font-medium text-white dark:bg-white dark:text-gray-900"
                    >
                      Accepter
                    </button>
                  </form>
                  <form
                    action={rejectListingAction}
                    className="flex flex-1 flex-wrap items-center gap-2"
                  >
                    <input type="hidden" name="listingId" value={listing.id} />
                    <input
                      type="text"
                      name="reason"
                      required
                      placeholder="Motif du refus"
                      className="min-w-48 flex-1 rounded border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-transparent"
                    />
                    <button
                      type="submit"
                      className="rounded border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-700"
                    >
                      Refuser
                    </button>
                  </form>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
