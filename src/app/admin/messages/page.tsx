import { desc } from 'drizzle-orm';
import type { Metadata } from 'next';

import { db } from '@/db/client';
import { contactMessages } from '@/db/schema';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';

const PAGE_TITLE = 'Messages de contact';

export const metadata: Metadata = { title: PAGE_TITLE };

const dateFormatter = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export default async function AdminMessagesPage() {
  const messages = await db.select().from(contactMessages).orderBy(desc(contactMessages.createdAt));

  return (
    <div>
      <Breadcrumbs
        items={[{ label: 'Administration', href: '/admin/logements' }, { label: PAGE_TITLE }]}
      />
      <h2 className="text-lg font-semibold">{PAGE_TITLE}</h2>

      <div className="mt-6 space-y-4">
        {messages.length === 0 && (
          <p className="text-sm text-gray-500">Aucun message pour le moment.</p>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-medium">
                {msg.name} —{' '}
                <a href={`mailto:${msg.email}`} className="underline">
                  {msg.email}
                </a>
              </p>
              <p className="text-xs text-gray-500">{dateFormatter.format(msg.createdAt)}</p>
            </div>
            <p className="mt-2 text-sm whitespace-pre-line text-gray-700 dark:text-gray-300">
              {msg.message}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
