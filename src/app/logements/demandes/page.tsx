import { desc, eq } from 'drizzle-orm';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { db } from '@/db/client';
import { bookings, listingFestivals, listings, users } from '@/db/schema';
import { BookingRequestActions } from '@/components/bookings/BookingRequestActions';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { expireOverdueAcceptedBookings } from '@/lib/bookings/actions';
import { computeAge } from '@/lib/profile/utils';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Demandes reçues' };

const STATUS_LABELS: Record<string, string> = {
  pending: 'En attente',
  accepted: 'Acceptée',
  rejected: 'Refusée',
  cancelled: 'Annulée',
};

const dateFormatter = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });

function formatStay(arrivalDate: Date | null, departureDate: Date | null, guestsCount: number) {
  const dates =
    arrivalDate && departureDate
      ? `Du ${dateFormatter.format(arrivalDate)} au ${dateFormatter.format(departureDate)}`
      : null;
  const guests = `${guestsCount} personne${guestsCount > 1 ? 's' : ''}`;
  return [dates, guests].filter(Boolean).join(' · ');
}

export default async function HostBookingRequestsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/connexion');
  }

  // Pas de tâche planifiée dans ce projet — balayage paresseux avant de lire les demandes, pour
  // que le statut affiché reflète tout de suite une annulation automatique due au délai de 48h
  // dépassé (booking-requests-setup.md §18), sans attendre qu'une autre page le déclenche.
  await expireOverdueAcceptedBookings();

  const rows = await db
    .select({
      booking: bookings,
      guest: users,
    })
    .from(bookings)
    .innerJoin(listingFestivals, eq(listingFestivals.id, bookings.listingFestivalId))
    .innerJoin(listings, eq(listings.id, listingFestivals.listingId))
    .innerJoin(users, eq(users.id, bookings.guestId))
    .where(eq(listings.hostId, user.id))
    .orderBy(desc(bookings.createdAt));

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <Breadcrumbs
        items={[
          { label: 'Mon compte', href: '/compte' },
          { label: 'Demandes reçues sur mon logement' },
        ]}
      />
      <h1 className="text-2xl font-semibold">Demandes reçues sur mon logement</h1>

      {rows.length === 0 ? (
        <p className="mt-8 text-sm text-gray-500">Aucune demande pour le moment.</p>
      ) : (
        <div className="mt-8 space-y-4">
          {rows.map(({ booking, guest }) => {
            const age = computeAge(guest.birthDate);
            const details = [guest.city, age !== null ? `${age} ans` : null]
              .filter(Boolean)
              .join(' · ');
            return (
              <div
                key={booking.id}
                className="rounded-lg border border-gray-200 p-4 dark:border-gray-800"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex items-start gap-3">
                    {guest.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- URL Supabase Storage, pas de config remotePatterns pour l'instant
                      <img
                        src={guest.avatarUrl}
                        alt=""
                        className="h-10 w-10 shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <div
                        aria-hidden="true"
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-200 text-sm font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                      >
                        {(guest.fullName ?? '?').charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className="font-medium">Demande de {guest.fullName ?? 'Utilisateur'}</p>
                      {details && <p className="text-sm text-gray-500">{details}</p>}
                      <p className="text-sm text-gray-500">
                        {formatStay(
                          booking.arrivalDate,
                          booking.departureDate,
                          booking.guestsCount
                        )}
                      </p>
                      {booking.message && <p className="mt-2 text-sm">« {booking.message} »</p>}
                    </div>
                  </div>
                  <span className="rounded-full border border-gray-200 px-2 py-0.5 text-xs dark:border-gray-700">
                    {STATUS_LABELS[booking.status] ?? booking.status}
                  </span>
                </div>

                {booking.status === 'rejected' && booking.rejectionReason && (
                  <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                    Motif du refus : {booking.rejectionReason}
                  </p>
                )}
                {booking.status === 'cancelled' && booking.rejectionReason && (
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    {booking.rejectionReason}
                  </p>
                )}
                {booking.status === 'accepted' && booking.acceptanceMessage && (
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    Ton message : « {booking.acceptanceMessage} »
                  </p>
                )}
                {booking.status === 'accepted' &&
                  (booking.guestEmailShared ? (
                    <>
                      <p className="mt-2 text-sm">Email du festivalier : {guest.email}</p>
                      <p className="mt-1 text-sm font-medium text-amber-600 dark:text-amber-400">
                        Ne tardez pas à contacter le festivalier pour l&apos;organisation.
                      </p>
                    </>
                  ) : (
                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                      En attente de l&apos;email du festivalier.
                    </p>
                  ))}

                {booking.status === 'pending' && <BookingRequestActions bookingId={booking.id} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
