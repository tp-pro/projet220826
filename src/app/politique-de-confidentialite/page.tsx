import type { Metadata } from 'next';

import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { siteConfig } from '@/config/site';

export const metadata: Metadata = { title: 'Politique de confidentialité' };

const updatedAt = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
}).format(new Date('2026-08-20'));

export default function PolitiqueConfidentialitePage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <Breadcrumbs items={[{ label: 'Politique de confidentialité' }]} />
      <h1 className="text-2xl font-semibold text-ink">Politique de confidentialité</h1>
      <p className="mt-2 text-sm text-muted">Dernière mise à jour : {updatedAt}</p>

      <p className="mt-4 rounded border border-beacon/40 bg-beacon/15 px-4 py-3 text-sm text-beacon">
        ⚠️ Page générée automatiquement à partir du fonctionnement réel de l’application. Les
        coordonnées du responsable de traitement (voir{' '}
        <a href="/mentions-legales" className="underline">
          mentions légales
        </a>
        ), la durée de conservation exacte et la localisation d’hébergement doivent être vérifiées
        et complétées avant la mise en ligne du site.
      </p>

      <div className="mt-8 space-y-8 text-sm text-contour">
        <section>
          <h2 className="text-base font-semibold text-ink">1. Responsable du traitement</h2>
          <p className="mt-2">
            {siteConfig.name} est édité par {siteConfig.legal.editorName} (voir{' '}
            <a href="/mentions-legales" className="underline">
              mentions légales
            </a>
            ), responsable du traitement des données décrites ci-dessous. Pour toute question,
            contactez{' '}
            <a href={`mailto:${siteConfig.legal.contactEmail}`} className="underline">
              {siteConfig.legal.contactEmail}
            </a>
            .
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-ink">2. Données que nous collectons</h2>
          <dl className="mt-3 space-y-4">
            <div>
              <dt className="font-medium text-ink">Compte utilisateur</dt>
              <dd className="mt-1">
                Email et mot de passe (gérés par notre prestataire d’authentification, jamais
                stockés en clair par {siteConfig.name}), nom complet, téléphone, photo de profil et
                bio (facultatifs), ville et date de naissance.
              </dd>
            </div>
            <div>
              <dt className="font-medium text-ink">Profil festivalier</dt>
              <dd className="mt-1">
                Ta ville et ton âge (calculé à partir de ta date de naissance — la date exacte n’est
                jamais transmise) ne sont révélés à un hôte que lorsque tu lui envoies une demande
                de mise en relation, jamais avant.
              </dd>
            </div>
            <div>
              <dt className="font-medium text-ink">Fiche logement (hôtes)</dt>
              <dd className="mt-1">
                Titre, description, adresse, ville, pays, photos, équipements, prix et distance
                déclarée par rapport au festival. Ces informations sont visibles publiquement une
                fois la fiche validée par un administrateur.
              </dd>
            </div>
            <div>
              <dt className="font-medium text-ink">Justificatif de domicile (optionnel)</dt>
              <dd className="mt-1">
                Si tu choisis de fournir un justificatif de domicile (facture EDF, internet…) pour
                obtenir la pastille « Hôte certifié », ce document est stocké dans un espace de
                stockage privé, jamais accessible publiquement. Seul un administrateur peut le
                consulter, dans le cadre de la modération de ta fiche.
              </dd>
            </div>
            <div>
              <dt className="font-medium text-ink">Demandes de mise en relation et avis</dt>
              <dd className="mt-1">
                Le contenu de tes demandes (message, dates), et le contenu des avis que tu rédiges
                ou reçois après un séjour (note et commentaire).
              </dd>
            </div>
            <div>
              <dt className="font-medium text-ink">Formulaire de contact</dt>
              <dd className="mt-1">
                Si tu nous écris via la page{' '}
                <a href="/contact" className="underline">
                  Contact
                </a>
                , nous conservons ton nom, ton email et le contenu de ton message afin de te
                répondre.
              </dd>
            </div>
            <div>
              <dt className="font-medium text-ink">Données techniques</dt>
              <dd className="mt-1">
                Un cookie de session strictement nécessaire à ton authentification (voir §7). Aucun
                cookie publicitaire ni de mesure d’audience n’est déposé pour l’instant.
              </dd>
            </div>
          </dl>
        </section>

        <section>
          <h2 className="text-base font-semibold text-ink">3. Pourquoi nous les utilisons</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Créer et gérer ton compte, te permettre de te connecter ;</li>
            <li>
              Mettre en relation hôtes et festivaliers autour d’un festival (demandes, échange des
              informations nécessaires une fois la demande envoyée) ;
            </li>
            <li>
              Modérer les fiches logement avant publication, y compris via le justificatif de
              domicile facultatif ;
            </li>
            <li>Afficher les avis laissés après un séjour, comme élément de confiance ;</li>
            <li>Assurer la sécurité de la plateforme et prévenir les abus.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-ink">4. Base légale</h2>
          <p className="mt-2">
            L’exécution du contrat qui te lie à {siteConfig.name} (création de compte, mise en
            relation) pour l’essentiel des traitements ; notre intérêt légitime à assurer la
            sécurité et la bonne modération de la plateforme ; ton consentement lorsque tu choisis
            de renseigner des informations facultatives (bio, justificatif de domicile, ville, date
            de naissance).
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-ink">5. Qui a accès à tes données</h2>
          <p className="mt-2">
            Ton nom complet, ton email et ton téléphone ne sont jamais affichés publiquement. Seul
            ton prénom apparaît sur ta fiche logement si tu es hôte. Tes coordonnées ne sont
            partagées avec un festivalier ou un hôte qu’après acceptation d’une demande de mise en
            relation.
          </p>
          <p className="mt-2">
            Nos sous-traitants techniques (hébergement de la base de données, authentification et
            stockage des fichiers) traitent tes données pour notre compte, dans le cadre de leurs
            propres garanties de sécurité et de confidentialité — voir §1 pour la localisation
            exacte de l’hébergement. Nous ne vendons ni ne partageons tes données à des fins
            commerciales ou publicitaires.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-ink">6. Durée de conservation</h2>
          <p className="mt-2">
            Tes données sont conservées tant que ton compte est actif. Si tu supprimes ton compte,
            tes données sont supprimées ou anonymisées dans un délai raisonnable, sauf obligation
            légale de conservation plus longue (ex : gestion d’un litige en cours).
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-ink">7. Cookies</h2>
          <p className="mt-2">
            {siteConfig.name} utilise uniquement un cookie de session strictement nécessaire pour te
            garder connecté·e. Ce cookie n’est pas soumis à consentement préalable (il est
            indispensable au fonctionnement du service) et n’est utilisé à aucune fin publicitaire
            ou de suivi. Aucun cookie tiers de mesure d’audience ou de publicité n’est déposé pour
            l’instant.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-ink">8. Sécurité</h2>
          <p className="mt-2">
            Les mots de passe ne sont jamais stockés en clair. Les documents sensibles (comme le
            justificatif de domicile) sont conservés dans un espace de stockage privé, non
            accessible publiquement, et consultables uniquement par un administrateur via un lien
            temporaire à usage unique. L’accès aux fonctions de modération est réservé aux comptes
            ayant le rôle administrateur.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-ink">9. Tes droits</h2>
          <p className="mt-2">
            Conformément au Règlement Général sur la Protection des Données (RGPD), tu disposes des
            droits suivants sur tes données personnelles :
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              <strong>Droit d’accès</strong> : obtenir une copie des données que nous détenons sur
              toi ;
            </li>
            <li>
              <strong>Droit de rectification</strong> : corriger des données inexactes — la plupart
              sont modifiables directement depuis ton{' '}
              <a href="/compte" className="underline">
                compte
              </a>
              ;
            </li>
            <li>
              <strong>Droit à l’effacement</strong> : demander la suppression de ton compte et de
              tes données ;
            </li>
            <li>
              <strong>Droit à la limitation</strong> et <strong>droit d’opposition</strong> au
              traitement de tes données ;
            </li>
            <li>
              <strong>Droit à la portabilité</strong> : recevoir tes données dans un format
              structuré et réutilisable.
            </li>
          </ul>
          <p className="mt-2">
            Pour exercer l’un de ces droits, contacte-nous à{' '}
            <a href={`mailto:${siteConfig.legal.contactEmail}`} className="underline">
              {siteConfig.legal.contactEmail}
            </a>
            . Tu peux aussi introduire une réclamation auprès de la{' '}
            <a
              href="https://www.cnil.fr/fr/plaintes"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              CNIL
            </a>
            .
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-ink">10. Modifications</h2>
          <p className="mt-2">
            Cette politique peut évoluer, notamment si de nouvelles fonctionnalités impliquent de
            nouveaux traitements de données. La date de dernière mise à jour est indiquée en haut de
            cette page.
          </p>
        </section>
      </div>
    </div>
  );
}
