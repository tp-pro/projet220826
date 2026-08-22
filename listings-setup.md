# Création de logement (côté hôte) — Journal d'implémentation

> Documente le vrai formulaire de création de logement (`/logements/nouveau`), qui remplace le placeholder décrit dans [`auth-setup.md`](auth-setup.md) §10. Complète [`dbshema.md`](dbshema.md) (modèle de données, règles métier) et [`db-setup.md`](db-setup.md) (migrations, pièges `drizzle-kit`).

---

## 1. Stack et décisions

- Formulaire = **Client Component** (`ListingForm.tsx`) piloté par `useActionState`, soumis à une **Server Action** (`createListingAction`) — même pattern que `SignUpForm`/`SignInForm` (`auth-setup.md`) et `FestivalForm` (`admin-setup.md`).
- Statut à la soumission : directement `pending_review` (pas d'étape `draft` éditable pour le MVP — nécessiterait une page de gestion des logements côté hôte, hors périmètre actuel).
- Toutes les évolutions de règles métier faites en cours de route sont répercutées dans `dbshema.md` (source de vérité du modèle de données) — ce document-ci se concentre sur l'implémentation.

## 2. Fichiers créés

| Fichier                                   | Rôle                                                                                                                        |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `src/app/logements/nouveau/page.tsx`      | Page protégée (redirige vers `/connexion` si non connecté), charge les festivals publiés côté serveur                       |
| `src/components/listings/ListingForm.tsx` | Formulaire (Client Component)                                                                                               |
| `src/lib/listings/actions.ts`             | Server Action `createListingAction` — validation + écriture en base                                                         |
| `src/lib/listings/constants.ts`           | Constantes partagées client/serveur (bucket, limites photos) — **volontairement sans dépendance à `service_role`**, voir §4 |
| `src/lib/listings/storage.ts`             | `uploadListingPhoto()` — upload vers Supabase Storage, serveur uniquement                                                   |
| `scripts/setup-storage.ts`                | Provisionne le bucket Storage (`npm run storage:setup`, idempotent)                                                         |

## 3. Évolutions de règles métier faites via ce formulaire

Toutes documentées en détail dans `dbshema.md` (§3.3, §3.5, §4.1, §4.2, §5) :

- **Un logement ↔ un seul festival** (`listing_festivals.listing_id` UNIQUE) — sélection via `<select>`, plus de multi-association.
- **Tarification par nuit et par voyageur** (`listings.price_per_night`, renommé depuis `price_default`) — plus de forfait fixe. Le nombre de nuits reste dérivé des dates du festival ± buffer, pas de sélection libre.
- **Distance au festival** (`listing_festivals.distance_km`) — déclarée manuellement par l'hôte, pas de géocodage automatique.
- **Service de navette optionnel** (`listing_festivals.has_shuttle` + `shuttle_cost`) — coût forcé à `0` côté serveur si la case n'est pas cochée, quelle que soit la valeur saisie dans le champ (protection contre une valeur cachée manipulée côté client).
- **Équipements** : liste fermée de 10 checkboxes (`AMENITIES` dans `ListingForm.tsx`) plutôt qu'un champ texte libre — stocké tel quel dans `listings.amenities` (jsonb).

## 4. Upload de photos (Supabase Storage)

### Bucket

`listing-photos` — public en lecture (nécessaire pour l'affichage sur les fiches logement), 5 Mo max par fichier, JPEG/PNG/WEBP uniquement. Provisionné via l'API Storage (`admin.storage.createBucket`), pas par SQL brut sur `storage.buckets` — plus robuste aux évolutions internes du schéma Supabase.

```bash
npm run storage:setup
```

### Pourquoi une séparation `constants.ts` / `storage.ts`

`storage.ts` importe `createAdminClient()` (clé `service_role`, secrète, définie comme variable serveur dans `src/config/env.ts`). Si `ListingForm.tsx` (Client Component) avait importé une constante depuis `storage.ts`, cet import aurait entraîné toute la chaîne de dépendances — y compris l'accès à la variable serveur — dans le bundle envoyé au navigateur. Les constantes partagées (`MAX_LISTING_PHOTOS`, `ALLOWED_PHOTO_TYPES`, `MAX_PHOTO_SIZE_BYTES`) sont donc isolées dans `constants.ts`, qui n'importe rien de serveur.

### Validation — client ET serveur

- **Client** (`ListingForm.tsx`) : limite à 4 fichiers à la sélection (au-delà, message d'erreur + réinitialisation du champ), `accept` restreint aux types autorisés — confort d'usage, pas une garantie de sécurité.
- **Serveur** (`createListingAction`) : revalidation complète — nombre ≤ 4, `file.type` dans la liste autorisée, `file.size` ≤ 5 Mo. Indispensable : un `accept`/limite HTML est uniquement une suggestion au navigateur, jamais une garantie contre un client modifié ou une requête forgée directement.

### Aperçu + suppression avant envoi

Les fichiers sélectionnés sont gardés en état React (`photos: File[]`), pas seulement dans l'`<input>` natif. Un aperçu (`URL.createObjectURL`) s'affiche pour chacun, avec une croix de suppression.

Point technique : un `FileList` natif (`input.files`) est **en lecture seule**, impossible de retirer un élément directement. La suppression reconstruit donc la sélection via l'API `DataTransfer` (`dataTransfer.items.add(file)` pour chaque fichier restant, puis `input.files = dataTransfer.files`) — technique standard pour ce cas, nécessaire pour que le fichier retiré n'atterrisse pas dans le `FormData` envoyé au serveur. Les `object URL` créés pour les aperçus sont libérés (`URL.revokeObjectURL`) au démontage/changement pour éviter les fuites mémoire.

### Ordre des opérations côté serveur

1. Validation de tous les champs (y compris les photos : nombre/type/taille) — échoue tôt, avant toute écriture.
2. Insertion du logement (`listings`) → récupère `listingId`.
3. Upload des photos vers Storage (chemin `${listingId}/${uuid}.${ext}`) → insertion des URLs publiques dans `listing_photos`.
4. Insertion de l'association `listing_festivals`.

Si l'upload échoue après la création du logement, l'action retourne une erreur explicite ("le logement a été créé mais reste à compléter") plutôt que de laisser l'utilisateur croire à un échec total — le logement existe déjà en `pending_review` à ce stade.

## 5. `next.config.ts`

Limite de taille des Server Actions relevée à `10mb` (`experimental.serverActions.bodySizeLimit`) — le défaut (~1 Mo) ne suffirait pas à transporter 4 photos jusqu'à 5 Mo chacune.

## 6. Comment tester

```bash
npm run dev
```

Connecté, aller sur [`/logements/nouveau`](http://localhost:3000/logements/nouveau) :

- Remplir le formulaire, sélectionner un festival, ajouter 2-3 photos → aperçu affiché
- Supprimer une photo via la croix → vérifier qu'elle disparaît de l'aperçu et n'est pas envoyée
- Soumettre → message de succès, logement visible en `pending_review` dans [`/admin/logements`](http://localhost:3000/admin/logements) (voir `admin-setup.md`)

## 7. Validé lors des tests

- ✅ Sélection de fichiers, aperçu, suppression via la croix, soumission — testé de bout en bout par l'utilisateur.
- ✅ Bucket Storage : upload, lecture publique, suppression — vérifiés via un smoke test direct (upload d'une image minimale, fetch de l'URL publique, statut 200).

## 8. Un seul logement par hôte + modification

Règle métier (voir `dbshema.md` §4.7 et §5) : un hôte ne gère qu'**un seul logement**. Pas de contrainte `UNIQUE(host_id)` en base — appliquée en code applicatif.

> Cette règle a brièvement été retirée puis rétablie en cours de route (le script de seed créait plusieurs logements par hôte de démo, ce qui a fait passer la contrainte pour une hypothèse erronée). Les données de seed ont depuis été corrigées à un logement par hôte (`scripts/seed.ts`), et la base réelle a été nettoyée en conséquence (logements en trop supprimés, avec cascade sur leurs photos/associations festival/réservations).

### Fichiers ajoutés/modifiés

| Fichier                                    | Rôle                                                                                                                                                         |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/app/logements/[id]/modifier/page.tsx` | Page d'édition — protégée (connexion + `hostId === user.id`, sinon `notFound()`), pré-remplit `ListingForm` avec les valeurs existantes                      |
| `src/app/logements/nouveau/page.tsx`       | Redirige vers `/logements/<id>/modifier` si l'hôte a déjà un logement (`SELECT ... WHERE host_id = user.id LIMIT 1`)                                         |
| `src/app/compte/page.tsx`                  | Lien "Créer un logement" devient "Mon logement" (→ édition) dès qu'un logement existe                                                                        |
| `src/components/listings/ListingForm.tsx`  | Généralisé pour servir création **et** édition (props `action`, `defaultValues?`, `submitLabel`, `successMessage`) — mêmes champs, pas de duplication de JSX |
| `src/lib/listings/actions.ts`              | Validation extraite dans `parseListingForm()`, partagée par `createListingAction` et la nouvelle `updateListingAction`                                       |
| `src/components/layout/RoleSwitcher.tsx`   | `isHostPath()` reconnaît `/logements/<id>/modifier` comme contexte "Hôte"                                                                                    |

### `updateListingAction` — points clés

- **Autorisation** : re-vérifie `existing.hostId === user.id` côté serveur avant toute écriture, sur l'id transmis via un champ caché (`listingId`) — jamais fait confiance à un id client sans re-contrôle.
- **Statut** : toute modification repasse systématiquement le logement en `pending_review` (`rejectionReason`/`reviewedBy`/`reviewedAt` réinitialisés, `submittedAt` mis à jour) — **y compris depuis `published`**, qui redevient donc indisponible publiquement jusqu'à revalidation admin. Conforme au workflow de modération §4.3 de `dbshema.md`. Pas de diff de contenu pour juger si la modification est "significative" : chaque soumission du formulaire déclenche la repasse en modération, même sans changement réel de valeur.
- **Photos** : diff entre l'existant et le formulaire soumis via un champ caché répété `keepPhotoIds` (un par photo conservée) — toute photo en base non listée dans `keepPhotoIds` est supprimée, les nouveaux fichiers sont uploadés et ajoutés à la suite. Le diff est scopé sur les photos du `listingId` déjà vérifié (une photo id d'un autre logement dans `keepPhotoIds` n'a aucun effet).
- **Association festival** : `UPDATE listing_festivals ... WHERE listing_id = <id>` (relation 1:1, cf. §3.5/§4.1) plutôt qu'un delete+insert.

### Indication de statut pendant l'édition

Si le logement est en `pending_review` au moment où l'hôte ouvre `/logements/[id]/modifier`, un bandeau apparaît en haut du formulaire, avant les champs :

> Cette fiche est en attente de validation par un administrateur — elle ne sera visible publiquement qu'une fois approuvée.

S'il est `published`, un second bandeau (même style) prévient que toute modification va le repasser en modération et le rendre temporairement indisponible :

> Cette fiche est publiée — toute modification la repassera en attente de validation par un administrateur, et elle deviendra temporairement invisible publiquement jusqu'à sa revalidation.

Même code couleur que la variante `pending` de `Badge` (voir `design-setup.md` §4) — cohérence avec les badges de statut affichés côté festivalier. Rien pour `rejected` (déjà couvert par le `successMessage`, désormais unique quel que soit le statut de départ puisque toute modification mène au même résultat, cf. ci-dessus) ni `draft`.

### Limite connue — photos supprimées non nettoyées du Storage

Quand une photo existante est retirée lors d'une modification, la ligne `listing_photos` est supprimée mais le fichier reste dans le bucket Supabase Storage (fichier orphelin — pas de fuite de données, juste du stockage inutilisé qui s'accumule). Pas traité pour le MVP ; à corriger si le volume devient significatif (appel à `supabase.storage.from(bucket).remove([...])` sur les chemins des photos supprimées, en s'assurant que l'échec de suppression Storage ne fait pas échouer la mise à jour en base).

### Revue sécurité

Revue dédiée effectuée sur ce diff (`updateListingAction`, diff de photos, `generateMetadata` de la page d'édition) : aucune vulnérabilité HIGH/MEDIUM confirmée. La piste la plus sérieuse envisagée — fuite du titre du logement via `generateMetadata` avant que le composant de page n'effectue sa vérification d'auth/ownership — a été écartée : un `redirect()`/`notFound()` dans le composant de page remplace entièrement la réponse HTTP, le `<title>` déjà résolu n'atteint jamais un client non autorisé.

## 9. Justificatif de domicile + pastille « hôte certifié »

Règle métier (voir `dbshema.md` §4.8 et §5) : un justificatif de domicile (facture EDF, internet...) **optionnel** conditionne l'affichage d'une pastille « Hôte certifié » sur la fiche logement et les cards de recherche.

### Fichiers ajoutés/modifiés

| Fichier                                                                      | Rôle                                                                                                           |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `src/db/schema.ts`                                                           | Colonne `listings.certification_document_path` (nullable) — chemin Storage, pas une URL                        |
| `drizzle/0008_daily_major_mapleleaf.sql`                                     | Migration correspondante                                                                                       |
| `src/lib/listings/constants.ts`                                              | `LISTING_CERTIFICATION_DOCS_BUCKET`, types/taille autorisés (JPEG/PNG/WEBP/PDF, 5 Mo)                          |
| `src/lib/listings/storage.ts`                                                | `uploadCertificationDocument()`, `deleteCertificationDocument()`, `getCertificationDocumentUrl()` (URL signée) |
| `scripts/setup-storage.ts`                                                   | Provisionne aussi le bucket privé `listing-certification-docs`                                                 |
| `src/lib/listings/actions.ts`                                                | `parseListingForm()` étendu (fichier + flag de suppression), upload/suppression dans les deux actions          |
| `src/components/listings/ListingForm.tsx`                                    | Section « Justificatif de domicile » (optionnel) — sélection, statut « fourni », suppression                   |
| `src/components/listings/ListingCard.tsx`, `src/app/logements/[id]/page.tsx` | Pastille « Hôte certifié » si `certification_document_path` non NULL                                           |
| `src/app/admin/logements/page.tsx`                                           | Lien « consulter » vers le justificatif pour la modération                                                     |
| `src/app/admin/logements/[id]/justificatif/route.ts`                         | Route Handler — génère l'URL signée à la demande et redirige (voir §11)                                        |

### Bucket privé — différence avec les photos

Contrairement à `listing-photos` (public, nécessaire pour l'affichage), `listing-certification-docs` est **privé** (`public: false` à la création) : ce document contient des données personnelles de l'hôte (adresse, nom). Le champ en base stocke un **chemin**, jamais une URL publique. Seule la route `/admin/logements/[id]/justificatif` (§11) génère une URL signée, à la demande, au moment où l'admin clique — jamais exposé côté festivalier ni dans le formulaire hôte lui-même (qui n'affiche qu'un statut « fourni », pas de lien).

### Upload/suppression — pattern différent des photos

Même structure de validation client + serveur que les photos (type MIME, taille max), mais logique de remplacement différente : à la modification, un nouveau fichier envoyé **remplace** l'ancien, et l'ancien est activement supprimé du bucket via `deleteCertificationDocument()` (best-effort, erreur avalée) — contrairement aux photos où un fichier retiré reste orphelin en Storage (limite connue documentée plus haut). Choix motivé par la nature des données (justificatif personnel) plutôt que par un souci de coût de stockage.

Le champ caché `removeCertificationDocument` (envoyé uniquement si l'hôte supprime le justificatif sans le remplacer) distingue trois cas côté serveur : nouveau fichier → remplace, flag de suppression seul → passe à `NULL`, ni l'un ni l'autre → ne touche pas la colonne.

### Pas de vérification de contenu

Pour le MVP, la présence du fichier suffit à déclencher la pastille — aucune étape de validation manuelle par l'admin dédiée à ce document (distincte de la modération générale du logement, §8). L'admin peut consulter le justificatif depuis `/admin/logements` mais rien ne bloque la publication si le contenu s'avère non pertinent ; seule la modération globale (accepter/refuser) reste le point de contrôle.

### Comment tester

```bash
npm run dev
```

Connecté en tant qu'hôte, sur `/logements/nouveau` ou `/logements/[id]/modifier` : joindre un justificatif → soumettre → la pastille « Hôte certifié » apparaît sur la fiche logement et les cards de recherche. Depuis `/admin/logements` (connecté admin), un lien « consulter » ouvre le document via une URL signée temporaire.

### Validé lors des tests

- ✅ Migration appliquée, bucket privé provisionné (`npm run storage:setup`).
- ✅ Upload réel vers Supabase Storage, URL signée fonctionnelle (200, `image/png`) ; URL publique équivalente refusée (400) — confirme que le bucket est bien privé.
- ✅ Pastille « Hôte certifié » affichée sur la fiche logement (`/logements/[id]`) et la card de recherche (`/festivals/[slug]`) une fois le justificatif renseigné.
- ✅ Lien « consulter » affiché et fonctionnel sur `/admin/logements` pour un logement avec justificatif.
- ✅ `tsc --noEmit` et `eslint` propres sur l'ensemble des fichiers touchés.

## 10. Vue de modération enrichie — `/admin/logements`

Jusqu'ici la liste de modération n'affichait qu'un résumé minimal (titre, hôte, ville/pays, type, statut) — insuffisant pour juger une fiche, en particulier après une modification par l'hôte (toute édition repasse en `pending_review`, §9 ci-dessus / dbshema.md §4.3). Chaque card affiche maintenant l'intégralité du contenu soumis, pour que l'admin puisse valider ou refuser en connaissance de cause sans naviguer ailleurs :

- Photos (miniatures)
- Adresse complète, capacité, prix, équipements, description
- Festival associé (nom, ville/pays, distance, navette)
- Justificatif de domicile (lien « consulter », déjà en place depuis §9)

### Requêtes ajoutées

Deux requêtes supplémentaires dans `AdminListingsPage`, scopées aux `listingIds` de la page courante (respecte le filtre par statut) : `listing_photos` (groupées en `Map<listingId, photos[]>`) et `listing_festivals` jointe à `festivals` (groupée en `Map<listingId, association>`). Pas de requête N+1 : chacune se fait en un seul `SELECT ... WHERE listing_id IN (...)`.

### Pourquoi pas une page de détail dédiée

Une page `/admin/logements/[id]` séparée (sur le modèle de `/admin/festivals/[id]`) aurait ajouté une navigation superflue pour un besoin de simple consultation — la liste reste l'unique écran de modération, cohérent avec le flow existant (filtre par statut + actions Accepter/Refuser inline).

## 11. Correctif — URL signée expirée (`InvalidJWT`)

Symptôme rapporté : cliquer sur « consulter » depuis `/admin/logements` renvoyait `{"statusCode":"400","error":"InvalidJWT","message":"\"exp\" claim timestamp check failed"}`.

**Cause** : l'URL signée était générée **au rendu de la page** (une par ligne, dans une `Map`, cf. §9), avec une validité de 60s. Le temps que l'admin repère la fiche et clique — surtout après avoir parcouru plusieurs cards enrichies (§10) — le token avait quasi systématiquement expiré. Le format du fichier (JPG) n'y était pour rien : `image/jpeg` fait bien partie des types autorisés (`ALLOWED_CERTIFICATION_DOC_TYPES`, §9) et se stocke avec l'extension `.jpg`.

**Correctif** : `src/app/admin/logements/[id]/justificatif/route.ts`, un Route Handler qui génère l'URL signée **au moment du clic** (à la requête) et redirige (`NextResponse.redirect`) — plutôt qu'une URL pré-générée embarquée dans le HTML. Le lien « consulter » pointe désormais vers cette route interne, toujours fraîche quel que soit le délai entre le chargement de la page et le clic. Un Route Handler n'hérite pas de la protection de `admin/layout.tsx` (qui ne s'applique qu'aux pages) : `requireAdmin()` y est appelé explicitement, même règle que pour les Server Actions (`src/lib/auth/admin.ts`).

Validé en conditions réelles : navigation directe vers la route → redirection vers Supabase Storage → fichier JPG servi avec succès (plus d'erreur `InvalidJWT`).

## 12. Notification légère à la validation — `/compte`

Quand l'admin approuve un logement (`status` → `published`), l'hôte voit désormais une bannière sur `/compte` : « 🎉 Ta fiche « [titre] » a été validée par un administrateur — elle est maintenant visible publiquement. (le [date de `reviewed_at`]) ».

**Choix délibéré : pas de nouvelle table `notifications`** — même position que pour les demandes de mise en relation (`booking-requests-setup.md` §4). La bannière est **entièrement dérivée** de `listings.status`/`listings.reviewed_at`, déjà en base : `myListing?.status === 'published'` dans `src/app/compte/page.tsx`. Aucun état "lu/non lu" à gérer : la bannière reste visible tant que le logement est publié, et disparaît d'elle-même dès que l'hôte modifie sa fiche (toute édition repasse en `pending_review`, §9/§4.3 dbshema.md) — son propre cycle de vie sert de mécanisme d'acquittement, sans code dédié.

Limite assumée : si l'hôte ne modifie jamais sa fiche après validation, la bannière reste affichée indéfiniment (pas de fenêtre de temps ni de dismiss). Acceptable pour le MVP — un vrai système avec état lu/non lu resterait l'évolution naturelle si le besoin s'en fait sentir, comme documenté pour les demandes de mise en relation.

Validé en conditions réelles : logement publié → bannière visible sur `/compte` du bon hôte, avec titre et date de validation corrects.

## 13. Revue sécurité — §9 à §12

Revue dédiée effectuée sur l'ensemble des changements ci-dessus (justificatif de domicile, vue de modération enrichie, route de consultation admin, bannière de validation) : **aucune vulnérabilité HIGH/MEDIUM confirmée.**

Points vérifiés :

- **Bucket privé réellement privé** : `listing-certification-docs` créé avec `public: false` (contrairement à `listing-photos`/`festival-covers`, publics) — seul `createAdminClient()` (`service_role`, jamais exposé au navigateur) y lit/écrit. Aucune URL publique n'est générée pour ce bucket, contrairement à `uploadListingPhoto`.
- **Consultation admin sans fuite** : `/admin/logements/[id]/justificatif` re-dérive le chemin du justificatif depuis la base à partir de l'`id` de la route (jamais un chemin Storage fourni par le client) et appelle `requireAdmin()` explicitement — un Route Handler n'hérite pas de la protection du layout `/admin`, cf. le commentaire dans le fichier lui-même. Un utilisateur non-admin (ou non connecté) est redirigé avant toute lecture en base ou génération d'URL signée.
- **Pas d'IDOR sur l'upload/suppression** : `updateListingAction` conserve la vérification `existing.hostId !== user.id` déjà en place avant toute écriture, y compris pour le nouveau champ `certificationDocumentPath` — un hôte ne peut pas remplacer ou supprimer le justificatif d'un autre logement que le sien.
- **Validation serveur, pas seulement client** : type MIME et taille revérifiés dans `parseListingForm` (`ALLOWED_CERTIFICATION_DOC_TYPES`, `MAX_CERTIFICATION_DOC_SIZE_BYTES`), même pattern que les photos — un `accept`/une limite HTML ne protège jamais contre une requête forgée.
- **Pas de PII exposée hors admin** : la bannière `/compte` et la pastille « Hôte certifié » n'exposent qu'un booléen (présence du document) ou les propres title/status de l'hôte, jamais le contenu du justificatif — seul l'admin, via la route dédiée, peut le consulter.

Piste la plus sérieuse envisagée puis écartée : une URL signée exposée dans un `Location` de redirection plutôt que dans un `href` HTML n'ouvre pas de surface nouvelle — le token n'est de toute façon valable que 60s et n'était déjà pas plus protégé quand il était embarqué directement dans la page (§11).

## 14. Disponibilité autour du festival — arrivée/départ ± 1 jour

Demande explicite : qu'un hôte puisse indiquer si son logement est disponible **uniquement pendant les dates du festival**, ou si les festivaliers peuvent **arriver 1 jour avant et repartir 1 jour après**.

### Contexte — des colonnes déjà en base, jamais exposées

`listing_festivals.arrival_buffer_before`/`arrival_buffer_after` existent depuis le modèle de données initial (`dbshema.md` §3.5, `DEFAULT 1`) et sont déjà utilisées pour calculer la fenêtre de séjour affichée au festivalier sur le formulaire de demande (`booking-requests-setup.md` §12) — mais aucune interface ne permettait à l'hôte de les modifier : tout logement était donc, de fait, toujours en "± 1 jour" (valeur par défaut), sans que l'hôte ait pu choisir "festival uniquement".

### Choix d'implémentation — un choix binaire, pas deux champs numériques

Plutôt que d'exposer `arrival_buffer_before` et `arrival_buffer_after` comme deux champs numériques indépendants (complexité et flexibilité non demandées), le formulaire propose un choix binaire symétrique via deux boutons radio (`arrivalBuffer` = `'0'` ou `'1'`), qui fixe les deux colonnes à la même valeur. Cohérent avec la formulation de la demande ("uniquement... ou bien... 1 jour avant et 1 jour après").

### Fichiers modifiés

- [`src/components/listings/ListingForm.tsx`](src/components/listings/ListingForm.tsx) — `<fieldset>` "Disponibilité" avec 2 boutons radio, dans la section "Festival associé" (sous le service de navette)
- [`src/lib/listings/actions.ts`](src/lib/listings/actions.ts) — `parseListingForm` lit `arrivalBuffer`, allow-list stricte (`'0'` → 0, tout le reste → 1, jamais fait confiance à une valeur radio transmise par le client) ; `createListingAction`/`updateListingAction` écrivent `arrivalBufferBefore`/`arrivalBufferAfter` (même valeur) dans `listing_festivals`
- [`src/app/logements/[id]/modifier/page.tsx`](src/app/logements/%5Bid%5D/modifier/page.tsx) — passe `arrivalBufferDays: association?.arrivalBufferBefore ?? 1` en valeur par défaut (pas de nouvelle requête, `association` sélectionnait déjà la ligne complète)

Pas de migration : les deux colonnes existaient déjà, seule leur écriture depuis un formulaire est nouvelle.

### Comment tester

1. Connecté en hôte, ouvrir `/logements/[id]/modifier`
2. Section "Festival associé" → "Disponibilité" : basculer entre "Uniquement pendant les dates du festival" et "± 1 jour", enregistrer
3. Recharger la page d'édition → le choix est bien mémorisé
4. Le changement modifie la fenêtre proposée au festivalier sur le formulaire de demande (`booking-requests-setup.md` §12) une fois le logement revalidé par un admin (toute modification repasse en `pending_review`, §8)

### Validé lors des tests

- ✅ Bascule vers "Uniquement pendant les dates du festival" (valeur `0`) sur un logement réel, enregistrée et vérifiée après rechargement de la page d'édition
- ✅ Remise à "± 1 jour" (valeur `1`, défaut d'origine) pour restaurer l'état réel du logement de test, et re-validation par un admin pour republier la fiche (une édition la repasse en attente, §8)
- ✅ `npx tsc --noEmit` et `npx eslint .` propres

## 15. Nombre minimum et maximum de festivaliers

Demande explicite : qu'un hôte puisse indiquer un nombre minimum et un nombre maximum de festivaliers, bornés entre 2 et 10.

### Périmètre — types "bloquants" uniquement

Comme le champ `maxGuests` déjà existant, ce chantier ne concerne que les logements de type "bloquant" (`entire_place`, `private_room`) — les types "à places" (`camping_spot`, `glamping`, `couch`) utilisent un modèle de capacité différent (`spots_total`, un nombre de places plutôt qu'un nombre de voyageurs par réservation), non concerné par cette demande.

### Fichiers modifiés

- [`src/db/schema.ts`](src/db/schema.ts) — nouvelle colonne `listings.min_guests` (int, NULL), à côté de `max_guests` existant
- [`drizzle/0014_zippy_baron_zemo.sql`](drizzle/0014_zippy_baron_zemo.sql) — migration d'ajout simple, sans ambiguïté
- [`src/components/listings/ListingForm.tsx`](src/components/listings/ListingForm.tsx) — la section "Capacité & tarif" affiche, pour les types bloquants, deux champs côte à côte ("Nombre minimum de festivaliers" / "Nombre maximum de festivaliers"), tous deux avec `min={2} max={10}` HTML
- [`src/lib/listings/actions.ts`](src/lib/listings/actions.ts) — `parseListingForm` valide, pour les types bloquants : présence des deux valeurs, chacune comprise entre 2 et 10, et `minGuests <= maxGuests` — jamais fait confiance aux attributs `min`/`max` HTML seuls (même principe que partout ailleurs dans le projet)
- [`src/app/logements/[id]/modifier/page.tsx`](src/app/logements/%5Bid%5D/modifier/page.tsx) — passe `minGuests: listing.minGuests` en valeur par défaut
- Affichage de la capacité mis à jour à 3 endroits ([`src/components/listings/ListingCard.tsx`](src/components/listings/ListingCard.tsx), [`src/app/logements/[id]/page.tsx`](src/app/logements/%5Bid%5D/page.tsx), [`src/app/admin/logements/page.tsx`](src/app/admin/logements/page.tsx)) : affiche "2 à 4 voyageurs" (ou "2-4 voyageurs" sur la card, format plus compact) si `minGuests` est renseigné, repli sur l'ancien libellé "N voyageurs max/maximum" sinon (logements créés avant ce chantier — colonne nullable, pas de backfill rétroactif)

### Non traité — pas de répercussion sur le filtre public

Le filtre "Nombre de personnes" de la page festival (`src/app/festivals/[slug]/page.tsx`) continue de ne vérifier que `gte(listings.maxGuests, guestsFilter)` (le logement peut accueillir au moins N personnes) — il ne vérifie pas `minGuests <= guestsFilter`. Un festivalier cherchant "1 personne" verrait donc toujours un logement dont l'hôte a fixé un minimum de 4 dans les résultats de recherche. Non corrigé ici pour rester strictement dans le périmètre demandé (l'hôte peut désormais indiquer le minimum ; en tenir compte dans la recherche publique est une extension séparée).

**Mise à jour (`booking-requests-setup.md` §13)** : le formulaire de **demande** (`RequestBookingForm.tsx`), lui, applique désormais bien `minGuests` — un festivalier peut toujours _voir_ un logement en dessous de sa capacité minimale dans la recherche, mais ne peut plus lui envoyer de demande pour moins de personnes que ce que l'hôte exige. Seul le filtre de recherche reste à corriger.

### Comment tester

1. Connecté en hôte sur un logement de type "Logement entier"/"Chambre privée", ouvrir `/logements/[id]/modifier`
2. Section "Capacité & tarif" : "Nombre minimum de festivaliers" / "Nombre maximum de festivaliers", tous deux bornés 2-10
3. Essayer minimum > maximum → rejeté côté serveur ("Le minimum de festivaliers ne peut pas dépasser le maximum.")
4. Enregistrer des valeurs valides (ex : 2 et 4) → affichées comme "2 à 4 voyageurs" sur la fiche logement, la card et la vue de modération admin

### Validé lors des tests

- ✅ Soumission minimum (3) > maximum (2) sur un logement réel → rejetée avec le message attendu, rien enregistré
- ✅ Soumission valide (2, 4) → enregistrée, persistée après rechargement de la page d'édition
- ✅ "2 à 4 voyageurs" affiché correctement sur la fiche logement publique, "2-4 voyageurs" sur la card de la page festival, et "2 à 4 voyageurs" dans la vue de modération admin
- ✅ Logement revalidé par un admin pour republier la fiche (une édition la repasse en attente, §8)
- ✅ `npx tsc --noEmit` et `npx eslint .` propres
- ✅ Migration `0014` appliquée sans erreur sur la base de dev

## 16. Même borne 2-10 pour le nombre de places (types "à places")

Demande explicite, en complément direct de §15 : le champ "Nombre de places disponibles" (`spots_total`, types `camping_spot`/`glamping`/`couch`) doit lui aussi être compris entre 2 et 10 (auparavant juste `min={1}` côté client, aucune borne haute, aucune validation serveur au-delà de "positif").

### Fichiers modifiés

- [`src/components/listings/ListingForm.tsx`](src/components/listings/ListingForm.tsx) — `min={2} max={10}` sur l'input `spotsTotal`, texte d'aide "Entre 2 et 10 places."
- [`src/lib/listings/actions.ts`](src/lib/listings/actions.ts) — `parseListingForm` valide `2 <= spotsTotal <= 10` pour les types non bloquants, même principe que §15 (jamais fait confiance au `min`/`max` HTML seul)

Pas de migration : `spots_total` existait déjà, seule sa validation change.

### Point à connaître — un logement réel en dessous de la nouvelle borne

Le logement de test "Canapé dispo pour 1 festivalier" (Marc Dubois, `couch`) avait `spots_total = 1` avant ce chantier — en dessous de la nouvelle borne minimale. Vérifié en conditions réelles : une tentative d'enregistrement sans changer cette valeur est bien rejetée côté serveur. Pour finaliser la vérification, la valeur a été remontée à 2 (seule option valide la plus proche) puis la fiche republiée par un admin — **le titre de l'annonce ("... pour 1 festivalier") n'a pas été mis à jour en conséquence** et reste maintenant incohérent avec sa capacité réelle (2). À corriger manuellement si besoin (changer le titre, ou toute autre valeur ≥ 2 selon la véritable capacité du canapé).

### Comment tester

1. Connecté en hôte sur un logement de type "Camping / emplacement"/"Glamping"/"Canapé", ouvrir `/logements/[id]/modifier`
2. "Nombre de places disponibles" borné 2-10 côté client ; une valeur hors bornes envoyée directement (contournement du client) est rejetée côté serveur

### Validé lors des tests

- ✅ Logement réel avec `spots_total = 1` (avant ce chantier) → tentative de sauvegarde sans changement rejetée côté serveur ("Le nombre de places disponibles doit être compris entre 2 et 10.")
- ✅ Valeur valide (2) → enregistrée, logement revalidé par un admin
- ✅ `npx tsc --noEmit` et `npx eslint .` propres

## 17. Retour utilisateur — le chiffre 1 ne doit pas être saisissable

Capture d'écran fournie : deux bulles de validation natives du navigateur superposées de façon confuse (une pour "Nombre de places disponibles" hors bornes, une autre pour "Ville" vide), donnant l'impression que le message d'erreur pointe vers le mauvais champ. Demande explicite : "à la création d'un logement je ne dois pas pouvoir renseigner le chiffre 1".

### Cause

`min={2}`/`max={10}` (§15/§16) sont des attributs HTML natifs : ils bloquent la **soumission** du formulaire, mais n'empêchent pas de **taper** 1 dans le champ — la valeur invalide reste visible jusqu'à ce que le navigateur affiche sa bulle native au moment de la tentative de soumission. Sur un formulaire avec plusieurs champs invalides à la fois, ces bulles natives peuvent se chevaucher visuellement de façon trompeuse (comme sur la capture fournie), sans que ce soit un bug du code de l'application à proprement parler — plutôt une limite de l'UX de validation native du navigateur pour un formulaire à plusieurs contraintes simultanées.

### Corrigé — correction immédiate au blur, plus de dépendance à la bulle native

[`src/components/listings/ListingForm.tsx`](src/components/listings/ListingForm.tsx) — nouvelle fonction `clampGuestCountInput`, attachée en `onBlur` sur les trois champs concernés (`minGuests`, `maxGuests`, `spotsTotal`) : dès que le champ perd le focus, une valeur hors de `[2, 10]` est immédiatement ramenée à la borne la plus proche (1 → 2, 15 → 10). Le chiffre 1 ne peut donc plus **rester** dans le champ au-delà du blur — corrigé avant même une tentative de soumission, sans attendre ni dépendre de la bulle de validation native (qui reste en place comme filet de sécurité supplémentaire, ex : soumission au clavier sans quitter le champ). Les attributs `min`/`max` HTML sont conservés (curseur natif, revalidation serveur déjà en place aux §15/§16).

### Comment tester

1. Sur `/logements/[id]/modifier` ou `/logements/nouveau`, cliquer dans "Nombre de places disponibles" (ou "Nombre minimum/maximum de festivaliers"), taper `1`, puis cliquer ailleurs (perte de focus)
2. Le champ affiche `2` immédiatement, sans bulle de validation à gérer

### Validé lors des tests

- ✅ Valeur forcée à `1` puis événement de perte de focus (`focusout`) déclenché sur `spotsTotal` → corrigée à `2` immédiatement, avant toute tentative de soumission
- ✅ Rechargement de la page après ce test (sans soumettre) → aucune donnée modifiée en base, confirmant que le test n'a touché que l'état local du champ
- ✅ `npx tsc --noEmit` et `npx eslint .` propres

## 18. Suppression du logement par l'hôte

Demande explicite : "lorsque je suis hôte je dois pouvoir supprimer mon logement, lorsque je clic sur le bouton j'ai une information de validation de l'action. Si j'ai au moins une réservation en cours le bouton est grisé et j'ai l'information [...]".

### Règle métier

Un logement avec au moins une réservation **acceptée** (`bookings.status = 'accepted'`) ne peut pas être supprimé — l'hôte doit d'abord attendre la fin du séjour ou une annulation. Une simple demande `pending` ne bloque pas la suppression (seule une réservation confirmée compte comme "en cours", cohérent avec le vocabulaire déjà utilisé sur `/logements/demandes` et `/mes-demandes`, `booking-requests-setup.md`).

### Fichiers créés/modifiés

- [`src/lib/listings/actions.ts`](src/lib/listings/actions.ts) — `listingHasActiveBooking(listingId)` (jointure `bookings`/`listing_festivals`, réutilisée à la fois pour griser le bouton côté page et revérifiée côté serveur) et `deleteListingAction` (revérifie la propriété **et** l'absence de réservation active avant de supprimer — jamais fait confiance à l'état désactivé du bouton seul). Le justificatif de domicile (donnée personnelle, bucket privé) est explicitement supprimé du Storage ; photos et lignes `listing_festivals`/`bookings` liées sont supprimées en cascade par la base (`onDelete: 'cascade'`, `dbshema.md`).
- [`src/components/listings/DeleteListingButton.tsx`](src/components/listings/DeleteListingButton.tsx) — bouton avec confirmation, grisé + message explicatif quand `hasActiveBooking`.
- [`src/components/ui/ConfirmDialog.tsx`](src/components/ui/ConfirmDialog.tsx) — **nouveau composant générique**, boîte de dialogue centrée basée sur `<dialog>` natif (focus trap, fermeture Échap/clic-extérieur gérés nativement), en remplacement de `window.confirm()` pour une confirmation au design du site plutôt qu'une popup navigateur brute (retour utilisateur explicite : "créé une pop design aligné au centre de l'écran"). Réutilisé ensuite pour la suppression de compte (§12 de `auth-setup.md`).
- [`src/app/logements/[id]/modifier/page.tsx`](src/app/logements/[id]/modifier/page.tsx) — section "Zone de danger" en bas de page, calcule `hasActiveBooking` côté serveur.

### Comment tester

1. Connecté en hôte sans réservation acceptée sur son logement, `/logements/[id]/modifier` → bouton "Supprimer mon logement" actif, clic → boîte de dialogue centrée de confirmation → suppression effective, redirection vers `/compte`
2. Même page, avec une réservation `accepted` sur ce logement → bouton grisé, message "Tu as une réservation en cours, tu ne peux pas supprimer ton logement."

### Validé lors des tests

- ✅ Bouton actif → boîte de dialogue centrée (capture fournie confirmant le remplacement de la popup navigateur), "Annuler" ferme sans rien soumettre
- ✅ Bouton avec réservation active → grisé, message affiché
- ✅ `npx tsc --noEmit`, `npx eslint .` et `npx prettier --check` propres
