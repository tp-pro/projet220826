import type { Metadata } from 'next';

import { FestivalForm } from '@/components/admin/FestivalForm';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { createFestivalAction } from '@/lib/admin/festivals-actions';

export const metadata: Metadata = { title: 'Nouveau festival' };

export default function NewFestivalPage() {
  return (
    <div className="max-w-lg">
      <Breadcrumbs
        items={[
          { label: 'Administration', href: '/admin/logements' },
          { label: 'Festivals', href: '/admin/festivals' },
          { label: 'Nouveau festival' },
        ]}
      />
      <h2 className="text-lg font-semibold">Nouveau festival</h2>
      <div className="mt-4">
        <FestivalForm action={createFestivalAction} submitLabel="Créer le festival" />
      </div>
    </div>
  );
}
