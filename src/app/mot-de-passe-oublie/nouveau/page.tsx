import type { Metadata } from 'next';

import { NewPasswordForm } from '@/components/auth/NewPasswordForm';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';

export const metadata: Metadata = { title: 'Nouveau mot de passe' };

export default function NewPasswordPage() {
  return (
    <div className="mx-auto max-w-sm px-4 py-12">
      <Breadcrumbs
        items={[{ label: 'Connexion', href: '/connexion' }, { label: 'Nouveau mot de passe' }]}
      />
      <h1 className="text-2xl font-semibold">Nouveau mot de passe</h1>
      <div className="mt-6">
        <NewPasswordForm />
      </div>
    </div>
  );
}
