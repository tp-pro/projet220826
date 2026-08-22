import type { Metadata } from 'next';
import Link from 'next/link';

import { SignUpForm } from '@/components/auth/SignUpForm';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';

export const metadata: Metadata = { title: 'Inscription' };

export default function InscriptionPage() {
  return (
    <div className="mx-auto max-w-sm px-4 py-12">
      <Breadcrumbs items={[{ label: 'Inscription' }]} />
      <h1 className="text-2xl font-semibold">Créer un compte</h1>
      <p className="mt-1 text-sm text-gray-500">
        Un seul type de compte : tu pourras à la fois publier des logements et réserver.
      </p>
      <div className="mt-6">
        <SignUpForm />
      </div>
      <p className="mt-6 text-sm text-gray-500">
        Déjà un compte ?{' '}
        <Link href="/connexion" className="font-medium underline">
          Se connecter
        </Link>
      </p>
    </div>
  );
}
