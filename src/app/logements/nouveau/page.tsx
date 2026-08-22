import { asc, eq } from 'drizzle-orm';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { db } from '@/db/client';
import { festivals, listings } from '@/db/schema';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { ListingForm } from '@/components/listings/ListingForm';
import { createListingAction } from '@/lib/listings/actions';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Créer un logement' };

export default async function NewListingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/connexion');
  }

  // Un hôte ne peut pas créer plus d'un logement — s'il en a déjà un, on le redirige
  // vers sa fiche pour la modifier plutôt que de lui permettre d'en créer un second.
  const [existingListing] = await db
    .select({ id: listings.id })
    .from(listings)
    .where(eq(listings.hostId, user.id))
    .limit(1);

  if (existingListing) {
    redirect(`/logements/${existingListing.id}/modifier`);
  }

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

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <Breadcrumbs items={[{ label: 'Créer un logement' }]} />
      <h1 className="text-2xl font-semibold">Créer un logement</h1>
      <p className="mt-2 text-gray-500">
        Renseigne les informations de ta fiche logement, elle sera soumise à validation avant
        d&apos;être visible publiquement.
      </p>

      <div className="mt-8">
        <ListingForm festivals={publishedFestivals} action={createListingAction} />
      </div>
    </div>
  );
}
