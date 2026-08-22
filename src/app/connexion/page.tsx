import type { Metadata } from 'next';
import Link from 'next/link';

import { SignInForm } from '@/components/auth/SignInForm';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';

export const metadata: Metadata = { title: 'Connexion' };

export default function ConnexionPage() {
  return (
    <div className="mx-auto max-w-sm px-4 py-12">
      <Breadcrumbs items={[{ label: 'Connexion' }]} />
      <h1 className="text-2xl font-semibold">Connexion</h1>
      <div className="mt-6">
        <SignInForm />
      </div>
      <p className="mt-3 text-sm text-gray-500">
        <Link href="/mot-de-passe-oublie" className="font-medium underline">
          Mot de passe oublié ?
        </Link>
      </p>
      <p className="mt-6 text-sm text-gray-500">
        Pas encore de compte ?{' '}
        <Link href="/inscription" className="font-medium underline">
          Créer un compte
        </Link>
      </p>
    </div>
  );
}
