import type { Metadata } from 'next';

import { ContactForm } from '@/components/contact/ContactForm';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';

export const metadata: Metadata = { title: 'Contact' };

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <Breadcrumbs items={[{ label: 'Contact' }]} />
      <h1 className="text-2xl font-semibold text-ink">Contact</h1>
      <p className="mt-2 text-muted">
        Une question, un problème, une suggestion ? Écris-nous, on te répond dès que possible.
      </p>

      <div className="mt-8">
        <ContactForm />
      </div>
    </div>
  );
}
