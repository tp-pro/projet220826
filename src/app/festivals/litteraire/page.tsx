import type { Metadata } from 'next';

import { CategoryFestivalsPage } from '@/components/festivals/CategoryFestivalsPage';

export const metadata: Metadata = { title: 'Festivals littéraires' };

export default function LiteraryFestivalsPage() {
  return (
    <CategoryFestivalsPage
      category="litteraire"
      title="Festivals littéraires"
      emptyMessage="Aucun festival littéraire publié pour le moment."
    />
  );
}
