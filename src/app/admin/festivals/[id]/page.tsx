import { count, eq } from 'drizzle-orm';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { db } from '@/db/client';
import { festivals, listingFestivals } from '@/db/schema';
import { DeleteFestivalButton } from '@/components/admin/DeleteFestivalButton';
import { FestivalForm } from '@/components/admin/FestivalForm';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { updateFestivalAction } from '@/lib/admin/festivals-actions';

function formatAssociatedListingCount(listingCount: number) {
  return listingCount === 0
    ? 'Aucun logement associé'
    : `${listingCount} logement${listingCount > 1 ? 's' : ''} associé${listingCount > 1 ? 's' : ''}`;
}

function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const [festival] = await db
    .select({ name: festivals.name })
    .from(festivals)
    .where(eq(festivals.id, id))
    .limit(1);

  return { title: festival ? `Modifier ${festival.name}` : 'Festival' };
}

export default async function EditFestivalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [festival] = await db.select().from(festivals).where(eq(festivals.id, id)).limit(1);

  if (!festival) {
    notFound();
  }

  // Tous les logements associés (tous statuts confondus) — vue admin, pas la disponibilité
  // publique (contrairement à FestivalCard.tsx sur la page d'accueil).
  const [{ listingCount }] = await db
    .select({ listingCount: count(listingFestivals.id) })
    .from(listingFestivals)
    .where(eq(listingFestivals.festivalId, id));

  return (
    <div className="max-w-lg">
      <Breadcrumbs
        items={[
          { label: 'Administration', href: '/admin/logements' },
          { label: 'Festivals', href: '/admin/festivals' },
          { label: `Modifier ${festival.name}` },
        ]}
      />
      <h2 className="text-lg font-semibold">Modifier « {festival.name} »</h2>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        {formatAssociatedListingCount(listingCount)}
      </p>
      <div className="mt-4">
        <FestivalForm
          action={updateFestivalAction}
          submitLabel="Enregistrer"
          defaultValues={{
            id: festival.id,
            name: festival.name,
            slug: festival.slug,
            city: festival.city,
            country: festival.country,
            description: festival.description,
            categories: festival.categories,
            dateStart: toDateInputValue(festival.dateStart),
            dateEnd: toDateInputValue(festival.dateEnd),
            coverImageUrl: festival.coverImageUrl,
            status: festival.status,
          }}
        />
      </div>

      <div className="mt-10 rounded-lg border border-red-200 p-4 dark:border-red-900">
        <h3 className="text-sm font-semibold text-red-600 dark:text-red-400">Zone de danger</h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Supprime définitivement ce festival, ainsi que ses associations avec des logements
          {listingCount > 0 ? ` (${listingCount} actuellement)` : ''}, les demandes de mise en
          relation et les avis qui en découlent.
        </p>
        <div className="mt-3">
          <DeleteFestivalButton festivalId={festival.id} festivalName={festival.name} />
        </div>
      </div>
    </div>
  );
}
