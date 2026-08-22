import Link from 'next/link';

import { requireAdmin } from '@/lib/auth/admin';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Administration</h1>
        <Link href="/" className="text-sm text-gray-500 underline">
          Retour au site
        </Link>
      </div>
      <nav className="mt-4 flex gap-4 border-b border-gray-200 pb-2 text-sm dark:border-gray-800">
        <Link href="/admin/logements" className="hover:underline">
          Logements
        </Link>
        <Link href="/admin/hotes" className="hover:underline">
          Hôtes
        </Link>
        <Link href="/admin/festivals" className="hover:underline">
          Festivals
        </Link>
        <Link href="/admin/messages" className="hover:underline">
          Messages
        </Link>
      </nav>
      <div className="mt-6">{children}</div>
    </div>
  );
}
