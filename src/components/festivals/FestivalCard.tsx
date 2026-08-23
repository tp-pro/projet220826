import type { InferSelectModel } from 'drizzle-orm';
import Link from 'next/link';

import type { festivals } from '@/db/schema';
import { Badge } from '@/components/ui/Badge';
import { buttonClass } from '@/components/ui/Button';
import { FESTIVAL_CATEGORY_LABELS } from '@/lib/festivals/constants';

type Festival = InferSelectModel<typeof festivals>;

const dateFormatter = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });
const dateFormatterWithYear = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

function formatDateRange(start: Date, end: Date) {
  return `${dateFormatter.format(start)} – ${dateFormatterWithYear.format(end)}`;
}

function formatListingCount(count: number) {
  return count === 0
    ? 'Aucun logement disponible'
    : `${count} logement${count > 1 ? 's' : ''} disponible${count > 1 ? 's' : ''}`;
}

export function FestivalCard({
  festival,
  listingCount,
}: {
  festival: Festival;
  listingCount: number;
}) {
  return (
    <Link
      href={`/festivals/${festival.slug}`}
      className="flex h-full flex-col overflow-hidden rounded-lg border border-border bg-surface transition-colors hover:border-contour"
    >
      <div className="bg-topo h-40 w-full shrink-0">
        {festival.coverImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- URLs externes variées (seed, futur Storage), pas de config remotePatterns pour l'instant
          <img
            src={festival.coverImageUrl}
            alt={festival.name}
            className="h-full w-full object-cover"
          />
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h2 className="font-semibold text-ink">{festival.name}</h2>
        <p className="mt-1 text-sm text-muted">
          {festival.city}, {festival.country}
        </p>
        <p className="mt-1 text-sm text-muted">
          {formatDateRange(festival.dateStart, festival.dateEnd)}
        </p>
        <div className="mt-3 mb-4 flex flex-wrap items-center gap-2">
          {festival.categories.map((category) => (
            <Badge key={category} variant="muted">
              {FESTIVAL_CATEGORY_LABELS[category] ?? category}
            </Badge>
          ))}
          <span className="text-xs font-medium text-contour rounded-full px-2.5 py-0.5 border border-border">
            {formatListingCount(listingCount)}
          </span>
        </div>
        <span className={buttonClass('secondary', 'mt-auto w-full justify-center py-2')}>
          Voir les logements
        </span>
      </div>
    </Link>
  );
}
