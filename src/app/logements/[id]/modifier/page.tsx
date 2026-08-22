import { asc, eq } from 'drizzle-orm';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { db } from '@/db/client';
import { festivals, listingFestivals, listingPhotos, listings } from '@/db/schema';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { DeleteListingButton } from '@/components/listings/DeleteListingButton';
import { ListingForm } from '@/components/listings/ListingForm';
import { listingHasActiveBooking, updateListingAction } from '@/lib/listings/actions';
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
    .where(eq(listings.id, id))
    .limit(1);

  return { title: listing ? `Modifier ${listing.title}` : 'Modifier mon logement' };
}

export default async function EditListingPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/connexion');
  }

  const { id } = await params;

  const [listing] = await db.select().from(listings).where(eq(listings.id, id)).limit(1);
  if (!listing || listing.hostId !== user.id) {
    notFound();
  }

  const [association] = await db
    .select()
    .from(listingFestivals)
    .where(eq(listingFestivals.listingId, id))
    .limit(1);

  const photos = await db
    .select({ id: listingPhotos.id, url: listingPhotos.url })
    .from(listingPhotos)
    .where(eq(listingPhotos.listingId, id))
    .orderBy(asc(listingPhotos.position));

  const publishedFestivals = await db
    .select({
      id: festivals.id,
      name: festivals.name,
      city: festivals.city,
      country: festivals.country,
    })
    .from(festivals)
    .where(eq(festivals.status, 'published'))
    .orderBy(asc(festivals.name));

  // Si le festival actuellement associé n'est plus publié (cas rare), on l'ajoute quand même
  // à la liste pour ne pas faire disparaître silencieusement l'association existante.
  const hasActiveBooking = await listingHasActiveBooking(id);

  let festivalOptions = publishedFestivals;
  if (association && !publishedFestivals.some((f) => f.id === association.festivalId)) {
    const [currentFestival] = await db
      .select({
        id: festivals.id,
        name: festivals.name,
        city: festivals.city,
        country: festivals.country,
      })
      .from(festivals)
      .where(eq(festivals.id, association.festivalId))
      .limit(1);
    if (currentFestival) {
      festivalOptions = [currentFestival, ...publishedFestivals];
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <Breadcrumbs
        items={[{ label: 'Mon compte', href: '/compte' }, { label: 'Modifier mon logement' }]}
      />
      <h1 className="text-2xl font-semibold">Modifier mon logement</h1>
      <p className="mt-2 text-gray-500">
        Un hôte ne gère qu&apos;un seul logement — modifie ses informations ici plutôt que d&apos;en
        créer un nouveau.
      </p>

      {listing.status === 'pending_review' && (
        <p className="mt-4 rounded border border-beacon/40 bg-beacon/15 px-4 py-3 text-sm font-medium text-beacon">
          Cette fiche est en attente de validation par un administrateur — elle ne sera visible
          publiquement qu&apos;une fois approuvée.
        </p>
      )}
      {listing.status === 'published' && (
        <p className="mt-4 rounded border border-beacon/40 bg-beacon/15 px-4 py-3 text-sm font-medium text-beacon">
          Cette fiche est publiée — toute modification la repassera en attente de validation par un
          administrateur, et elle deviendra temporairement invisible publiquement jusqu&apos;à sa
          revalidation.
        </p>
      )}

      <div className="mt-8">
        <ListingForm
          festivals={festivalOptions}
          action={updateListingAction}
          submitLabel="Enregistrer les modifications"
          successMessage="Modifications enregistrées — ta fiche est de nouveau en attente de validation par un administrateur avant d'être (re)publiée."
          defaultValues={{
            id: listing.id,
            title: listing.title,
            description: listing.description,
            address: listing.address,
            city: listing.city ?? '',
            country: listing.country ?? '',
            type: listing.type,
            minGuests: listing.minGuests,
            maxGuests: listing.maxGuests,
            spotsTotal: listing.spotsTotal,
            pricePerNight: listing.pricePerNight,
            amenities: Array.isArray(listing.amenities) ? (listing.amenities as string[]) : [],
            festivalId: association?.festivalId ?? null,
            distanceKm: association?.distanceKm ?? null,
            hasShuttle: association?.hasShuttle ?? false,
            shuttleCost: association?.shuttleCost ?? '0',
            arrivalBufferDays: association?.arrivalBufferBefore ?? 1,
            photos,
            hasCertificationDocument: Boolean(listing.certificationDocumentPath),
          }}
        />
      </div>

      <div className="mt-12 border-t border-border pt-6">
        <h2 className="text-lg font-semibold text-danger">Zone de danger</h2>
        <p className="mt-2 text-sm text-gray-500">
          Supprimer ton logement est définitif et retire aussi sa fiche des recherches.
        </p>
        <div className="mt-4">
          <DeleteListingButton
            listingId={listing.id}
            listingTitle={listing.title}
            hasActiveBooking={hasActiveBooking}
          />
        </div>
      </div>
    </div>
  );
}
