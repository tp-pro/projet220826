import Link from 'next/link';
import { siteConfig } from '@/config/site';
import { RoleSwitcher } from '@/components/layout/RoleSwitcher';
import { buttonClass } from '@/components/ui/Button';
import { PendingDot } from '@/components/ui/PendingDot';
import { getHostPendingActions } from '@/lib/host/pending-actions';
import { createClient } from '@/lib/supabase/server';

export async function Header() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const hasPendingAction = user
    ? await getHostPendingActions(user.id).then(
        ({ listingPendingReview, pendingBookingRequestsCount }) =>
          listingPendingReview || pendingBookingRequestsCount > 0
      )
    : false;

  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
        <Link href="/" className="font-display text-lg font-semibold tracking-wide text-ink">
          {siteConfig.name}
        </Link>
        <nav aria-label="Navigation principale" className="flex items-center gap-4 text-sm">
          {user ? (
            <>
              <RoleSwitcher />
              <Link href="/compte" className="relative font-medium text-contour hover:text-ink">
                Mon compte
                {hasPendingAction && (
                  <>
                    <PendingDot />
                    <span className="sr-only"> (action en attente)</span>
                  </>
                )}
              </Link>
            </>
          ) : (
            <>
              <Link href="/connexion" className="text-contour hover:text-ink">
                Connexion
              </Link>
              <Link href="/inscription" className={buttonClass('secondary', 'px-4 py-1.5')}>
                Inscription
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
