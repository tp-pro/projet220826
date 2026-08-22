import type { Metadata } from 'next';

import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { siteConfig } from '@/config/site';

export const metadata: Metadata = { title: 'Mentions légales' };

export default function MentionsLegalesPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <Breadcrumbs items={[{ label: 'Mentions légales' }]} />
      <h1 className="text-2xl font-semibold text-ink">Mentions légales</h1>

      <p className="mt-4 rounded border border-beacon/40 bg-beacon/15 px-4 py-3 text-sm text-beacon">
        ⚠️ Page générée automatiquement — les champs entre crochets (éditeur, hébergeur, directeur
        de la publication) doivent être complétés avec les informations réelles dans{' '}
        <code className="font-mono">src/config/site.ts</code> avant la mise en ligne du site. En
        l’état, ces mentions ne sont pas juridiquement valables.
      </p>

      <div className="mt-8 space-y-8 text-sm text-contour">
        <section>
          <h2 className="text-base font-semibold text-ink">Éditeur du site</h2>
          <p className="mt-2">
            {siteConfig.name} est édité par {siteConfig.legal.editorName}, dont le siège est situé{' '}
            {siteConfig.legal.editorAddress}.
          </p>
          <p className="mt-1">
            Contact :{' '}
            <a href={`mailto:${siteConfig.legal.contactEmail}`} className="underline">
              {siteConfig.legal.contactEmail}
            </a>
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-ink">Directeur de la publication</h2>
          <p className="mt-2">{siteConfig.legal.publicationDirector}</p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-ink">Hébergement</h2>
          <p className="mt-2">
            Le site est hébergé par {siteConfig.legal.hostName}. La base de données,
            l’authentification et le stockage de fichiers sont fournis par Supabase (voir la{' '}
            <a
              href="https://supabase.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              politique de confidentialité de Supabase
            </a>
            ).
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-ink">Propriété intellectuelle</h2>
          <p className="mt-2">
            L’ensemble des éléments du site {siteConfig.name} (textes, mise en page, logo,
            structure) est protégé par le droit de la propriété intellectuelle. Toute reproduction
            non autorisée est interdite. Le contenu publié par les utilisateurs (descriptions de
            logements, photos, avis) reste la propriété de son auteur, qui garantit disposer des
            droits nécessaires à sa publication.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-ink">Données personnelles</h2>
          <p className="mt-2">
            Le traitement des données personnelles collectées sur {siteConfig.name} est détaillé
            dans la{' '}
            <a href="/politique-de-confidentialite" className="underline">
              politique de confidentialité
            </a>
            .
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-ink">Contact</h2>
          <p className="mt-2">
            Pour toute question relative à ces mentions légales, contactez{' '}
            <a href={`mailto:${siteConfig.legal.contactEmail}`} className="underline">
              {siteConfig.legal.contactEmail}
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
