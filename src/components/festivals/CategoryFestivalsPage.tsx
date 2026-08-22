import { FestivalCard } from '@/components/festivals/FestivalCard';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import type { FESTIVAL_CATEGORIES } from '@/lib/festivals/constants';
import { getPublishedFestivalsWithListingCounts } from '@/lib/festivals/queries';

/**
 * Corps partagé des pages "tous les festivals d'une catégorie" (`/festivals/musique`,
 * `/festivals/litteraire`) — même requête et même carte que la page d'accueil (voir
 * lib/festivals/queries.ts), juste filtrées sur une seule catégorie et sans pagination
 * (nombre de festivals encore faible pour le MVP).
 */
export async function CategoryFestivalsPage({
  category,
  title,
  emptyMessage,
}: {
  category: (typeof FESTIVAL_CATEGORIES)[number];
  title: string;
  emptyMessage: string;
}) {
  const { festivals: publishedFestivals, listingCountByFestivalId } =
    await getPublishedFestivalsWithListingCounts();
  const filteredFestivals = publishedFestivals.filter((festival) =>
    festival.categories.includes(category)
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <Breadcrumbs items={[{ label: title }]} />
      <h1 className="text-2xl font-semibold text-ink">{title}</h1>

      {filteredFestivals.length === 0 ? (
        <p className="mt-8 text-sm text-gray-500">{emptyMessage}</p>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredFestivals.map((festival) => (
            <FestivalCard
              key={festival.id}
              festival={festival}
              listingCount={listingCountByFestivalId.get(festival.id) ?? 0}
            />
          ))}
        </div>
      )}
    </div>
  );
}
