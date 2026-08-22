import type { Metadata } from 'next';
import { Suspense } from 'react';

import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { ConfirmEmailAction } from '@/components/auth/ConfirmEmailAction';

export const metadata: Metadata = { title: 'Confirmation' };

export default function AuthConfirmPage() {
  return (
    <div className="mx-auto max-w-sm px-4 py-12">
      <Breadcrumbs items={[{ label: 'Confirmation' }]} />
      <h1 className="text-2xl font-semibold">Confirmation</h1>
      <div className="mt-6">
        <Suspense fallback={<p className="text-sm text-gray-500">Chargement…</p>}>
          <ConfirmEmailAction />
        </Suspense>
      </div>
    </div>
  );
}
