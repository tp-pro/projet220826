import { count, eq } from 'drizzle-orm';
import type { Metadata } from 'next';

import { db } from '@/db/client';
import { listings, users } from '@/db/schema';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { reactivateHostAction, suspendHostAction } from '@/lib/admin/hosts-actions';
import { createAdminClient } from '@/lib/supabase/admin';

const PAGE_TITLE = 'Gestion des hôtes';

export const metadata: Metadata = { title: PAGE_TITLE };

function isBanned(bannedUntil: string | undefined) {
  return Boolean(bannedUntil && new Date(bannedUntil) > new Date());
}

export default async function AdminHostsPage() {
  const hostRows = await db
    .select({ host: users, listingCount: count(listings.id) })
    .from(users)
    .innerJoin(listings, eq(listings.hostId, users.id))
    .groupBy(users.id);

  const admin = createAdminClient();
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const bannedUntilById = new Map(data?.users.map((u) => [u.id, u.banned_until]) ?? []);

  return (
    <div className="space-y-4">
      <Breadcrumbs
        items={[{ label: 'Administration', href: '/admin/logements' }, { label: PAGE_TITLE }]}
      />
      {hostRows.length === 0 && <p className="text-sm text-gray-500">Aucun hôte pour le moment.</p>}
      {hostRows.map(({ host, listingCount }) => {
        const banned = isBanned(bannedUntilById.get(host.id));

        return (
          <div
            key={host.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 p-4 dark:border-gray-800"
          >
            <div>
              <p className="font-medium">{host.fullName ?? host.email}</p>
              <p className="text-sm text-gray-500">
                {host.email} · {listingCount} logement{listingCount > 1 ? 's' : ''}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span
                className={`rounded-full border px-2 py-0.5 text-xs ${
                  banned
                    ? 'border-red-300 text-red-600 dark:border-red-800 dark:text-red-400'
                    : 'border-gray-200 text-gray-600 dark:border-gray-700 dark:text-gray-400'
                }`}
              >
                {banned ? 'Suspendu' : 'Actif'}
              </span>
              <form action={banned ? reactivateHostAction : suspendHostAction}>
                <input type="hidden" name="userId" value={host.id} />
                <button
                  type="submit"
                  className="rounded border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-700"
                >
                  {banned ? 'Réactiver' : 'Suspendre'}
                </button>
              </form>
            </div>
          </div>
        );
      })}
    </div>
  );
}
