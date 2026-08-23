import { eq } from 'drizzle-orm';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { db } from '@/db/client';
import { listings, users } from '@/db/schema';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { DeleteAccountButton } from '@/components/profile/DeleteAccountButton';
import { ProfileForm } from '@/components/profile/ProfileForm';
import { buttonClass } from '@/components/ui/Button';
import { PendingDot } from '@/components/ui/PendingDot';
import { signOutAction } from '@/lib/auth/actions';
import { getHostPendingActions } from '@/lib/host/pending-actions';
import { accountDeletionBlockReason } from '@/lib/profile/actions';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Mon compte' };

export default async function ComptePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/connexion');
  }

  const fullName =
    typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : null;

  const [dbUser] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
  const [myListing] = await db
    .select({
      id: listings.id,
      title: listings.title,
      status: listings.status,
      reviewedAt: listings.reviewedAt,
    })
    .from(listings)
    .where(eq(listings.hostId, user.id))
    .limit(1);

  const accountBlockReason = await accountDeletionBlockReason(user.id);
  const { listingPendingReview, pendingBookingRequestsCount } = await getHostPendingActions(
    user.id
  );

  return (
    <div className="mx-auto max-w-sm px-4 py-12">
      <Breadcrumbs items={[{ label: 'Mon compte' }]} />
      <h1 className="text-2xl font-semibold">Mon compte</h1>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href={myListing ? `/logements/${myListing.id}/modifier` : '/logements/nouveau'}
          className={buttonClass('primary', 'relative')}
        >
          {myListing ? 'Mon logement' : 'Créer un logement'}
          {listingPendingReview && (
            <>
              <PendingDot />
              <span className="sr-only"> (en attente de validation)</span>
            </>
          )}
        </Link>
        <Link href="/mes-demandes" className={buttonClass('secondary')}>
          Mes demandes de mise en relation
        </Link>
        <Link href="/logements/demandes" className={buttonClass('secondary', 'relative')}>
          Demandes reçues sur mon logement
          {pendingBookingRequestsCount > 0 && (
            <>
              <PendingDot />
              <span className="sr-only"> ({pendingBookingRequestsCount} en attente)</span>
            </>
          )}
        </Link>
      </div>

      {myListing?.status === 'published' && (
        <p
          role="status"
          className="mt-4 rounded border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-300"
        >
          🎉 Ta fiche « {myListing.title} » a été validée par un administrateur — elle est
          maintenant visible publiquement.
          {myListing.reviewedAt && ` (le ${myListing.reviewedAt.toLocaleDateString('fr-FR')})`}
        </p>
      )}

      <div className="mt-6">
        <ProfileForm
          displayName={fullName ?? user.email ?? '?'}
          defaultCity={dbUser?.city ?? null}
          defaultBirthDate={dbUser?.birthDate ?? null}
          defaultAvatarUrl={dbUser?.avatarUrl ?? null}
        />
      </div>

      <dl className="mt-8 space-y-3 text-sm">
        <div>
          <dt className="text-gray-500">Email</dt>
          <dd>{user.email}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Nom</dt>
          <dd>{fullName ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Compte créé le</dt>
          <dd>{new Date(user.created_at).toLocaleDateString('fr-FR')}</dd>
        </div>
      </dl>

      <div className="mt-8 space-y-2 text-sm">
        <Link href="/mot-de-passe-oublie/nouveau" className="block underline">
          Changer mon mot de passe
        </Link>
      </div>

      <form action={signOutAction} className="mt-8">
        <button
          type="submit"
          className="rounded border border-gray-300 px-4 py-2 text-sm dark:border-gray-700"
        >
          Déconnexion
        </button>
      </form>

      <div className="mt-12 border-t border-border pt-6">
        <h2 className="text-lg font-semibold text-danger">Zone de danger</h2>
        <p className="mt-2 text-sm text-gray-500">
          Supprimer ton compte est définitif et efface ton profil et tes données associées.
        </p>
        <div className="mt-4">
          <DeleteAccountButton blockReason={accountBlockReason} />
        </div>
      </div>
    </div>
  );
}
