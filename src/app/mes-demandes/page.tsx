import { desc, eq } from 'drizzle-orm';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { db } from '@/db/client';
import { bookings, festivals, listingFestivals, listings } from '@/db/schema';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { ShareEmailButton } from '@/components/bookings/ShareEmailButton';
import { expireOverdueAcceptedBookings } from '@/lib/bookings/actions';
import { isEmailShareWindowOpen } from '@/lib/bookings/availability';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Mes demandes' };

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

export default async function MyBookingRequestsPage() {
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
      listing: listings,
      festival: festivals,
    })
    .from(bookings)
    .innerJoin(listingFestivals, eq(listingFestivals.id, bookings.listingFestivalId))
    .innerJoin(listings, eq(listings.id, listingFestivals.listingId))
    .innerJoin(festivals, eq(festivals.id, listingFestivals.festivalId))
    .where(eq(bookings.guestId, user.id))
    .orderBy(desc(bookings.createdAt));

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <Breadcrumbs
        items={[
          { label: 'Mon compte', href: '/compte' },
          { label: 'Mes demandes de mise en relation' },
        ]}
      />
      <h1 className="text-2xl font-semibold">Mes demandes de mise en relation</h1>

      {rows.length === 0 ? (
        <p className="mt-8 text-sm text-gray-500">
          Tu n&apos;as envoyé aucune demande pour le moment.
        </p>
      ) : (
        <div className="mt-8 space-y-4">
          {rows.map(({ booking, listing, festival }) => (
            <div
              key={booking.id}
              className="rounded-lg border border-gray-200 p-4 dark:border-gray-800"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <Link href={`/logements/${listing.id}`} className="font-medium underline">
                    {listing.title}
                  </Link>
                  <p className="text-sm text-gray-500">{festival.name}</p>
                  <p className="text-sm text-gray-500">
                    {formatStay(booking.arrivalDate, booking.departureDate, booking.guestsCount)}
                  </p>
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
                <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                  {booking.rejectionReason}
                </p>
              )}
              {booking.status === 'accepted' && booking.acceptanceMessage && (
                <p className="mt-2 text-sm">« {booking.acceptanceMessage} »</p>
              )}
              {booking.status === 'accepted' &&
                (booking.guestEmailShared ? (
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    Ton email a été partagé avec l&apos;hôte.
                  </p>
                ) : isEmailShareWindowOpen(booking.respondedAt) ? (
                  user.email && <ShareEmailButton bookingId={booking.id} email={user.email} />
                ) : (
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    Le délai de 48h pour partager ton email avec l&apos;hôte est dépassé.
                  </p>
                ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
