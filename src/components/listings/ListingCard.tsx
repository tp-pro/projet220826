import type { InferSelectModel } from 'drizzle-orm';
import Link from 'next/link';

import type { listings } from '@/db/schema';
import { LISTING_TYPE_LABELS } from '@/lib/listings/constants';
import { Badge } from '@/components/ui/Badge';
import { buttonClass } from '@/components/ui/Button';

type Listing = InferSelectModel<typeof listings>;

function formatCapacity(listing: Listing) {
  if (listing.maxGuests) {
    // `minGuests` absent sur les logements créés avant son ajout (colonne nullable, pas de
    // backfill) — repli sur l'ancien libellé "max" seul dans ce cas.
    return listing.minGuests
      ? `${listing.minGuests}-${listing.maxGuests} voyageurs`
      : `${listing.maxGuests} voyageur${listing.maxGuests > 1 ? 's' : ''} max`;
  }
  if (listing.spotsTotal) {
    return `${listing.spotsTotal} place${listing.spotsTotal > 1 ? 's' : ''}`;
  }
  return null;
}

export function ListingCard({
  listing,
  photoUrl,
  distanceKm,
  hasShuttle,
  shuttleCost,
  bookingStatus = null,
}: {
  listing: Listing;
  photoUrl: string | null;
  distanceKm: string | null;
  hasShuttle: boolean;
  shuttleCost: string;
  /** Statut de mise en relation pour le festivalier courant sur ce logement —
   * `reserved` prime sur `pending` (un logement complet reste complet même si
   * la demande de l'utilisateur courant est encore en attente). */
  bookingStatus?: 'reserved' | 'pending' | null;
}) {
  const capacity = formatCapacity(listing);

  return (
    <Link
      href={`/logements/${listing.id}`}
      className="flex h-full flex-col overflow-hidden rounded-lg border border-border bg-surface transition-colors hover:border-contour"
    >
      <div className="bg-topo h-40 w-full shrink-0">
        {photoUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- URLs Supabase Storage, pas de config remotePatterns pour l'instant
          <img src={photoUrl} alt={listing.title} className="h-full w-full object-cover" />
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="font-semibold text-ink">{listing.title}</h3>
        <p className="mt-1 text-sm text-muted">
          {listing.city}, {listing.country}
        </p>
        <p className="mt-1 font-mono text-sm text-muted">
          {LISTING_TYPE_LABELS[listing.type] ?? listing.type}
          {capacity ? ` · ${capacity}` : ''}
        </p>
        <p className="mt-2 font-mono font-semibold text-ink">
          {listing.pricePerNight} €{' '}
          <span className="font-sans font-normal text-muted">/ nuit / voyageur</span>
        </p>
        <div className="mt-3 mb-4 flex flex-wrap items-center gap-2">
          {bookingStatus === 'reserved' && <Badge variant="danger">Déjà réservé</Badge>}
          {bookingStatus === 'pending' && <Badge variant="pending">En attente de réponse</Badge>}
          {listing.certificationDocumentPath && <Badge variant="success">Hôte certifié</Badge>}
          {distanceKm && <span className="text-xs text-contour">{distanceKm} km du festival</span>}
          {hasShuttle && (
            <Badge variant="shuttle">
              Navette {Number(shuttleCost) > 0 ? `(+${shuttleCost} €)` : 'incluse'}
            </Badge>
          )}
        </div>
        <span className={buttonClass('secondary', 'mt-auto w-full justify-center py-2')}>
          Voir le logement
        </span>
      </div>
    </Link>
  );
}
