import { asc } from 'drizzle-orm';
import type { Metadata } from 'next';
import Link from 'next/link';

import { db } from '@/db/client';
import { festivals, listingFestivals } from '@/db/schema';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { FESTIVAL_CATEGORY_LABELS } from '@/lib/festivals/constants';

export const metadata: Metadata = { title: 'Festivals' };

const dateFormatter = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

// Compte tous les logements associés (tous statuts confondus) — vue admin, pas la disponibilité
// publique : contrairement à `FestivalCard.tsx` (page d'accueil), on ne filtre ni sur
// `listings.status = 'published'` ni sur `listingFestivals.isActive`.
function formatAssociatedListingCount(count: number) {
  return count === 0
    ? 'Aucun logement associé'
    : `${count} logement${count > 1 ? 's' : ''} associé${count > 1 ? 's' : ''}`;
}

export default async function AdminFestivalsPage() {
  const [rows, listingFestivalRows] = await Promise.all([
    db.select().from(festivals).orderBy(asc(festivals.name)),
    db.select({ festivalId: listingFestivals.festivalId }).from(listingFestivals),
  ]);

  const listingCountByFestivalId = new Map<string, number>();
  for (const row of listingFestivalRows) {
    listingCountByFestivalId.set(
      row.festivalId,
      (listingCountByFestivalId.get(row.festivalId) ?? 0) + 1
    );
  }

  return (
    <div>
      <Breadcrumbs
        items={[{ label: 'Administration', href: '/admin/logements' }, { label: 'Festivals' }]}
      />
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{rows.length} festival(s)</p>
        <Link
          href="/admin/festivals/nouveau"
          className="rounded bg-gray-900 px-3 py-1.5 text-sm font-medium text-white dark:bg-white dark:text-gray-900"
        >
          + Nouveau festival
        </Link>
      </div>

      <div className="mt-6 space-y-4">
        {rows.map((festival) => (
          <Link
            key={festival.id}
            href={`/admin/festivals/${festival.id}`}
            className="block rounded-lg border border-gray-200 p-4 hover:border-gray-300 dark:border-gray-800 dark:hover:border-gray-700"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-medium">{festival.name}</p>
                <p className="text-sm text-gray-500">
                  {festival.city}, {festival.country} · {dateFormatter.format(festival.dateStart)} –{' '}
                  {dateFormatter.format(festival.dateEnd)}
                </p>
                {festival.categories.length > 0 && (
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {festival.categories
                      .map((category) => FESTIVAL_CATEGORY_LABELS[category] ?? category)
                      .join(' · ')}
                  </p>
                )}
                <p className="mt-1 text-xs font-medium text-gray-500 dark:text-gray-400">
                  {formatAssociatedListingCount(listingCountByFestivalId.get(festival.id) ?? 0)}
                </p>
              </div>
              <span className="rounded-full border border-gray-200 px-2 py-0.5 text-xs dark:border-gray-700">
                {festival.status === 'published' ? 'Publié' : 'Brouillon'}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
