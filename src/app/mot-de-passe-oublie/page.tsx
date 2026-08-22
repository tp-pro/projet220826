import type { Metadata } from 'next';
import Link from 'next/link';

import { RequestPasswordResetForm } from '@/components/auth/RequestPasswordResetForm';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';

export const metadata: Metadata = { title: 'Mot de passe oublié' };

export default function ForgotPasswordPage() {
  return (
    <div className="mx-auto max-w-sm px-4 py-12">
      <Breadcrumbs
        items={[{ label: 'Connexion', href: '/connexion' }, { label: 'Mot de passe oublié' }]}
      />
      <h1 className="text-2xl font-semibold">Mot de passe oublié</h1>
      <p className="mt-2 text-sm text-gray-500">
        Indique ton email, on t&apos;envoie un lien pour choisir un nouveau mot de passe.
      </p>
      <div className="mt-6">
        <RequestPasswordResetForm />
      </div>
      <p className="mt-6 text-sm text-gray-500">
        <Link href="/connexion" className="font-medium underline">
          Retour à la connexion
        </Link>
      </p>
    </div>
  );
}
