import Link from 'next/link';
import type { ReactNode } from 'react';

import { siteConfig } from '@/config/site';
import { FestivalCard } from '@/components/festivals/FestivalCard';
import { buttonClass } from '@/components/ui/Button';
import { getPublishedFestivalsWithListingCounts } from '@/lib/festivals/queries';

const REASSURANCE_POINTS: { icon: ReactNode; title: string; description: string }[] = [
  {
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        className="h-5 w-5"
        aria-hidden
      >
        <path
          d="M12 3.5 5 6v5.5c0 4.7 3 8.2 7 9.5 4-1.3 7-4.8 7-9.5V6l-7-2.5Z"
          strokeLinejoin="round"
        />
        <path d="M8.75 12.25l2.25 2.25 4.25-4.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    title: 'Logements vérifiés',
    description:
      "Chaque logement est modéré par notre équipe avant d'être publié. Pas de fiche fantôme.",
  },
  {
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        className="h-5 w-5"
        aria-hidden
      >
        <rect x="5" y="11" width="14" height="9" rx="2" />
        <path d="M8 11V8a4 4 0 0 1 8 0v3" strokeLinecap="round" />
      </svg>
    ),
    title: 'Confidentialité par défaut',
    description:
      "Aucune coordonnée n'est partagée tant que ta demande de mise en relation n'est pas acceptée.",
  },
  {
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        className="h-5 w-5"
        aria-hidden
      >
        <path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21Z" strokeLinejoin="round" />
        <circle cx="12" cy="9.5" r="2.5" />
      </svg>
    ),
    title: 'Toujours près des scènes',
    description:
      'Filtre par distance et navette pour trouver un logement à deux pas du site du festival.',
  },
];

export default async function Home() {
  const { festivals: publishedFestivals, listingCountByFestivalId } =
    await getPublishedFestivalsWithListingCounts();

  const musicFestivals = publishedFestivals.filter((festival) =>
    festival.categories.includes('musique')
  );
  const literaryFestivals = publishedFestivals.filter((festival) =>
    festival.categories.includes('litteraire')
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <section>
        <h2 className="mt-12 text-2xl font-semibold text-ink">
          Trouvez l’hébergement idéal pour votre festival sur {siteConfig.name}
        </h2>
        <p className="mt-2 text-muted">
          Trouve un logement pour ton prochain festival, proposé par les habitants à proximité.
        </p>
      </section>

      <section aria-labelledby="music-festivals-heading" className="mt-10">
        <div className="flex items-center justify-between gap-2">
          <h3 id="music-festivals-heading" className="text-lg font-semibold text-ink">
            Festivals de musique
          </h3>
          <Link href="/festivals/musique" className="text-sm text-contour hover:underline">
            Voir tous les festivals de musique →
          </Link>
        </div>
        {musicFestivals.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500">
            Aucun festival de musique publié pour le moment.
          </p>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {musicFestivals.map((festival) => (
              <FestivalCard
                key={festival.id}
                festival={festival}
                listingCount={listingCountByFestivalId.get(festival.id) ?? 0}
              />
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="literary-festivals-heading" className="mt-10">
        <div className="flex items-center justify-between gap-2">
          <h3 id="literary-festivals-heading" className="text-lg font-semibold text-ink">
            Festivals littéraires
          </h3>
          <Link href="/festivals/litteraire" className="text-sm text-contour hover:underline">
            Voir tous les festivals littéraires →
          </Link>
        </div>
        {literaryFestivals.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500">
            Aucun festival littéraire publié pour le moment.
          </p>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {literaryFestivals.map((festival) => (
              <FestivalCard
                key={festival.id}
                festival={festival}
                listingCount={listingCountByFestivalId.get(festival.id) ?? 0}
              />
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="reassurance-heading" className="mt-12">
        <h2 id="reassurance-heading" className="sr-only">
          Pourquoi choisir {siteConfig.name}
        </h2>
        <div className="grid grid-cols-1 gap-8 rounded-2xl border border-border bg-surface px-6 py-10 sm:grid-cols-3 sm:px-10">
          {REASSURANCE_POINTS.map((point) => (
            <div key={point.title} className="flex gap-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-beacon/12 text-beacon">
                {point.icon}
              </span>
              <div>
                <h3 className="font-semibold text-ink">{point.title}</h3>
                <p className="mt-1 text-sm text-contour">{point.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-topo rounded-2xl mt-12 px-6 py-14 sm:px-10 sm:py-16">
        <div className="max-w-xl">
          <h1 className="text-3xl leading-tight font-semibold text-balance text-ink sm:text-4xl">
            Transformez les festivals près de chez vous en gain
          </h1>
          <p className="mt-4 text-base text-contour sm:text-lg">
            Proposez votre logement aux festivaliers de passage et profitez simplement de la demande
            créée par les événements près de chez vous.
          </p>
          <Link href="/inscription" className={buttonClass('primary', 'mt-6')}>
            Créer mon logement
          </Link>
        </div>
      </section>
    </div>
  );
}
