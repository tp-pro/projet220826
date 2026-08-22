import type { Metadata } from 'next';

import { CategoryFestivalsPage } from '@/components/festivals/CategoryFestivalsPage';

export const metadata: Metadata = { title: 'Festivals de musique' };

export default function MusicFestivalsPage() {
  return (
    <CategoryFestivalsPage
      category="musique"
      title="Festivals de musique"
      emptyMessage="Aucun festival de musique publié pour le moment."
    />
  );
}
