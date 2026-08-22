# Mise en relation (demandes de réservation) — Journal d'implémentation

> Documente le flow "demande de mise en relation" entre festivalier et hôte, qui protège les informations confidentielles tant qu'aucune demande n'a été acceptée. Complète [`dbshema.md`](dbshema.md) (modèle de données), [`listings-setup.md`](listings-setup.md) (fiche logement) et [`auth-setup.md`](auth-setup.md) (profil/session).

---

## 1. Stack et décisions

- **Réutilise le modèle `bookings`** déjà prévu dans `dbshema.md` (pending/accepted/rejected) plutôt qu'un nouvel objet dédié — la mise en relation _est_ la demande de réservation : c'est en l'envoyant que le festivalier accepte de révéler ses informations non confidentielles à l'hôte.
- **Pas de système de notifications temps réel** (pas de table `notifications`, pas de websocket/polling) — chacun consulte une page dédiée (§4). Choix assumé pour rester dans le périmètre MVP.
- **Confidentialité** : aucune coordonnée (email, téléphone) n'est jamais affichée publiquement. Le nom complet de l'hôte est remplacé par son **prénom** sur la fiche logement — seule sa bio (contenu qu'il a lui-même rédigé pour se présenter) reste publique, au même titre qu'une description de logement.

## 2. Fichiers créés / modifiés

| Fichier                                             | Rôle                                                                                                 |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `src/lib/profile/utils.ts`                          | `getFirstName()`, `computeAge()` — jamais le nom complet ni la date de naissance exposés directement |
| `src/lib/profile/actions.ts`                        | `updateProfileAction` — édition ville + date de naissance                                            |
| `src/components/profile/ProfileForm.tsx`            | Formulaire de profil (Client Component)                                                              |
| `src/app/compte/page.tsx`                           | Modifié : ajout de la section "Mon profil" + liens vers les deux pages de demandes                   |
| `src/lib/bookings/actions.ts`                       | `requestBookingAction`, `acceptBookingAction`, `rejectBookingAction`                                 |
| `src/components/bookings/RequestBookingForm.tsx`    | Bouton + message optionnel côté festivalier (fiche logement)                                         |
| `src/components/bookings/BookingRequestActions.tsx` | Accepter / Refuser (avec motif) côté hôte                                                            |
| `src/app/logements/demandes/page.tsx`               | Page hôte : toutes les demandes reçues sur ses logements                                             |
| `src/app/mes-demandes/page.tsx`                     | Page festivalier : ses propres demandes envoyées + motif de refus                                    |
| `src/app/logements/[id]/page.tsx`                   | Modifié : prénom au lieu du nom complet, bouton de demande ou statut existant                        |

## 3. Flow complet

1. Un festivalier connecté, sur une fiche logement (`/logements/[id]`), voit un bouton **"Demander une mise en relation"** (+ message optionnel) s'il n'a pas déjà de demande en cours pour ce logement.
2. `requestBookingAction` crée un `booking` en `pending`. Vérifications : utilisateur connecté, pas son propre logement, pas de demande `pending`/`accepted` déjà existante pour ce même `listing_festival_id` (empêche les doublons).
3. L'hôte consulte [`/logements/demandes`](http://localhost:3000/logements/demandes) — liste de toutes les demandes reçues sur l'ensemble de ses logements, avec pour chacune : **nom complet, photo de profil, ville, âge** du festivalier (calculé depuis `birth_date`, jamais la date elle-même), et son message (voir §10 pour le détail de ce qui a changé côté nom/photo).
4. L'hôte **accepte** ou **refuse** (motif texte obligatoire) :
   - `acceptBookingAction` vérifie les invariants déjà documentés dans `dbshema.md` §3.6 avant de confirmer :
     - types "bloquants" (`entire_place`, `private_room`) : refuse si un autre `booking` `accepted` existe déjà sur ce `listing_festival_id` ;
     - types "à places" : refuse si `SUM(spots_booked)` des bookings acceptés + celui-ci dépasserait `spots_available` (fallback `listings.spots_total`).
   - `rejectBookingAction` exige un motif, stocké dans `bookings.rejection_reason`.
5. Le festivalier consulte [`/mes-demandes`](http://localhost:3000/mes-demandes) — statut de chacune de ses demandes, avec le motif si refusée.

## 4. Pourquoi pas de vraies notifications (choix explicite)

Le mot "notification" employé dans la demande initiale est couvert fonctionnellement par les deux pages dédiées (§3, points 3 et 5) plutôt que par une infrastructure temps réel. Chacun doit donc **consulter** sa page pour voir l'évolution, pas être alerté activement (pas de bell icon, pas de compteur non-lus, pas d'email). Documenté ici pour que ce choix soit explicite et révisable — une vraie table `notifications` + indicateur dans le `Header` serait l'évolution naturelle si le besoin de réactivité se confirme.

_(Même choix reconduit pour la validation d'un logement par l'admin — bannière dérivée du statut sur `/compte`, pas de table dédiée. Voir `listings-setup.md` §12.)_

## 5. Profil utilisateur — pourquoi c'était un prérequis

Avant cette fonctionnalité, `users` n'avait ni ville ni date de naissance, et rien ne permettait à un utilisateur de les renseigner. Sans ce formulaire, l'hôte n'aurait jamais rien vu de concret côté demandes (tous les champs vides). Le formulaire "Mon profil" a donc été ajouté sur `/compte` en même temps que les colonnes en base — les deux étaient nécessaires pour que la fonctionnalité soit testable de bout en bout.

Champs volontairement **non** collectés dans ce formulaire (hors périmètre) : nom complet (déjà géré à l'inscription), email/téléphone (jamais partagés sur la plateforme pour le MVP).

## 6. Comment tester

```bash
npm run dev
```

1. Se connecter avec `guest1@festcamp.test` → `/compte` → renseigner ville + date de naissance dans "Mon profil"
2. Aller sur une fiche logement d'un autre hôte (ex: un logement de `host1@festcamp.test`) → "Demander une mise en relation" (+ message optionnel)
3. Se connecter avec `host1@festcamp.test` → [`/logements/demandes`](http://localhost:3000/logements/demandes) → vérifier nom complet/photo/ville/âge affichés, accepter ou refuser (avec motif)
4. Revenir sur `guest1@festcamp.test` → [`/mes-demandes`](http://localhost:3000/mes-demandes) → vérifier le statut et, si refusé, le motif

## 7. Validé lors des tests

- ✅ Envoi de demande, blocage des doublons, blocage de l'auto-réservation — vérifiés par lecture de code et smoke test direct en base (création + acceptation sans erreur de contrainte).
- ✅ `tsc`/`eslint`/`prettier` clean sur l'ensemble des fichiers ajoutés/modifiés.
- ✅ Migration (`users.city`, `users.birth_date`, `bookings.rejection_reason`) générée et appliquée sans ambiguïté de renommage (contrairement à l'incident documenté dans `db-setup.md` §4.3).

## 8. Disponibilité et badges de statut (côté festivalier)

Ajouté après coup : le festivalier voit un indicateur de statut sur les cards logement (grille festival) et sur la fiche logement, pour ne pas naviguer/demander sur un logement déjà indisponible et pour se souvenir d'une demande en cours.

### Règle (`src/lib/bookings/availability.ts`)

`isFullyBooked()` applique **la même règle** que celle déjà utilisée par `acceptBookingAction` (§3) :

- Types **bloquants** (`entire_place`, `private_room`) : complet dès qu'un `booking` `accepted` existe sur ce `listing_festival_id`.
- Types **à places** : complet quand `SUM(spots_booked)` des bookings `accepted` atteint la capacité (`spots_available`, fallback `spots_total`).

Fonction pure, sans requête DB — chaque page fait sa propre requête d'agrégation (groupée sur toute une grille, ou unique sur une fiche) puis lui passe le résultat, plutôt que de lui déléguer l'accès base.

### Où ça s'affiche

| Contexte                                                             | Comportement                                                                                                                                                                                                                                                                                                          |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ListingCard` (grille festival, `src/app/festivals/[slug]/page.tsx`) | Badge rouge **"Déjà réservé"** si `isFullyBooked()` ; sinon badge bleu **"En attente de réponse"** si _le festivalier courant, et lui seul_, a une demande `pending` sur ce logement. "Déjà réservé" prime si les deux sont vrais.                                                                                    |
| Fiche logement (`src/app/logements/[id]/page.tsx`)                   | Si l'utilisateur n'a pas déjà de demande et que le logement est complet par quelqu'un d'autre, le formulaire de demande est remplacé par "Déjà réservé — ce logement n'est plus disponible pour ce festival." Le statut de la propre demande de l'utilisateur (pending/accepté/refusé) reste prioritaire et inchangé. |
| Accueil (`src/app/page.tsx`)                                         | Le compteur "N logements disponibles" par festival exclut les logements complets (`isFullyBooked()`), pas seulement les logements publiés.                                                                                                                                                                            |

### Revalidation

`requestBookingAction`, `acceptBookingAction` et `rejectBookingAction` appellent désormais `revalidateBookingViews()` (`src/lib/bookings/actions.ts`) — revalide la fiche logement, la grille du festival concerné, les deux inbox hôte/festivalier, et l'accueil si le statut passe à `accepted` (seul cas qui change le compteur de disponibilité).

Un premier passage ne revalidait que `/logements/demandes` : la fiche logement et la grille du festival gardaient des badges obsolètes tant qu'elles n'étaient pas revisitées après expiration du cache client Next.js. Bug découvert en testant une **vraie soumission de formulaire** (le badge n'apparaissait pas immédiatement) — un test par insertion SQL directe ne l'aurait pas révélé, puisqu'il contourne entièrement la Server Action et son `revalidatePath`.

### Comment tester

1. Connecté en festivalier, envoyer une demande sur un logement → le badge "En attente de réponse" doit apparaître **immédiatement** en revenant sur la grille du festival, sans redémarrer le serveur.
2. Se connecter avec l'hôte concerné, accepter la demande (`/logements/demandes`) → revenir en festivalier sur la grille : le logement passe à "Déjà réservé" (types bloquants) et l'accueil recompte les logements disponibles.
3. Se connecter avec un troisième compte n'ayant aucune demande sur ce logement → la fiche logement affiche "Déjà réservé" au lieu du formulaire de demande.

### Validé lors des tests

- ✅ Badges et message "Déjà réservé" vérifiés en direct avec plusieurs comptes réels (connexion/déconnexion successives, pas de simulation d'identité).
- ✅ Bug de revalidation identifié et corrigé en testant une vraie soumission de formulaire.
- ✅ `tsc`/`eslint`/`prettier` clean.

## 9. Photo de profil

La colonne `users.avatar_url` existait en base depuis le départ (`dbshema.md` §3.1) mais n'était utilisée nulle part — ni upload, ni affichage. Ajoutée au formulaire "Mon profil" (§5), même pattern que `uploadFestivalCover()`/`uploadListingPhoto()` : bucket Storage public dédié, upload/suppression gérés par la Server Action, jamais de confiance faite à une URL transmise par le client.

### Fichiers ajoutés/modifiés

| Fichier                                  | Rôle                                                                                                                                                                               |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/profile/constants.ts`           | Nouveau — `AVATARS_BUCKET`, types/taille autorisés (JPEG/PNG/WEBP, 5 Mo)                                                                                                           |
| `src/lib/profile/storage.ts`             | Nouveau — `uploadAvatar()`                                                                                                                                                         |
| `scripts/setup-storage.ts`               | Provisionne aussi le bucket public `avatars`                                                                                                                                       |
| `src/lib/profile/actions.ts`             | `updateProfileAction` étendu : upload/suppression de la photo, même logique `undefined` = colonne inchangée que `coverImageUrl` dans `updateFestivalAction`                        |
| `src/components/profile/ProfileForm.tsx` | Avatar cliquable en tête du formulaire (voir §9.1) — aperçu, suppression, sélection                                                                                                |
| `src/app/compte/page.tsx`                | Le résumé de compte statique en tête de page a été retiré et remplacé par l'avatar cliquable de `ProfileForm` — un seul avatar sur la page, plus de doublon non interactif         |
| `src/app/logements/[id]/page.tsx`        | Avatar de l'hôte affiché à côté de "Hébergé par X" — `host.avatarUrl` déjà disponible dans la requête existante (ligne complète `users`), aucune requête supplémentaire nécessaire |

### 9.1 Avatar cliquable — retour utilisateur

Première version : un `<input type="file">` natif classique, séparé de l'avatar affiché en résumé de compte (deux ronds sur la page, un seul cliquable). Retour utilisateur : cliquer sur l'avatar lui-même doit ouvrir le sélecteur de fichier.

Corrigé en fusionnant les deux : l'avatar (photo ou initiale de repli) est maintenant un `<button type="button">` accessible (`aria-label`, focus visible) qui déclenche `avatarInputRef.current?.click()` sur un `<input type="file">` caché visuellement (`sr-only`, toujours dans le DOM et joignable au clavier via le bouton). Une icône appareil photo apparaît au survol pour signaler l'affordance ; un lien texte "Changer la photo" reste disponible juste à côté pour la découvrabilité. Plus qu'un seul avatar sur la page, en tête du formulaire, à l'endroit où vivait l'ancien résumé statique.

### Pas de suppression active de l'ancien fichier

Contrairement au justificatif de domicile (`listings-setup.md` §9, donnée personnelle sensible supprimée activement du bucket privé au remplacement), l'avatar suit le même choix que les photos de logement et l'image de couverture de festival : remplacer un avatar laisse l'ancien fichier orphelin dans le bucket Storage, limite connue déjà acceptée ailleurs dans le projet plutôt qu'une incohérence nouvelle.

### Repli sans photo

`/compte` et la fiche logement affichent tous les deux un rond avec l'initiale du nom (ou de l'email à défaut) quand `avatar_url` est `NULL`, plutôt que rien ou une image cassée.

### Comment tester

```bash
npm run dev
```

Connecté, sur [`/compte`](http://localhost:3000/compte) : cliquer sur l'avatar (ou "Changer la photo") en tête de page → sélecteur de fichier natif → aperçu affiché immédiatement dans le même rond → "Enregistrer" → la photo persiste après rechargement. Aller sur la fiche d'un logement dont l'hôte a une photo : elle apparaît à côté de "Hébergé par [prénom]".

### Validé lors des tests

- ✅ Upload réel vers le bucket `avatars` (public), URL accessible.
- ✅ Clic sur l'avatar déclenche bien le `<input type="file">` caché (vérifié par un listener JS dédié, pas seulement visuellement).
- ✅ Sélection de fichier → aperçu immédiat dans le même rond, lien "Supprimer" apparaît.
- ✅ Cycle complet réel : sélection → "Enregistrer" → message "Profil mis à jour." → photo toujours présente après rechargement.
- ✅ Avatar affiché sur `/compte` (un seul, cliquable) et sur la fiche logement publique (`host.avatarUrl`).
- ✅ Repli sur l'initiale du nom vérifié pour un compte sans photo.
- ✅ `tsc --noEmit` et `eslint` propres.

## 10. Nom complet + photo visibles par l'hôte sur une demande reçue

Demande explicite : sur `/logements/demandes`, l'hôte doit voir le **nom complet** (pas seulement le prénom) et la **photo de profil** du festivalier qui lui a envoyé une demande.

### Ce qui change, et pourquoi ça reste cohérent avec §4/dbshema.md §5

Le principe "rien avant une demande" (§3, dbshema.md §5 "Confidentialité hôte/festivalier") n'est pas remis en cause : c'est toujours **uniquement au moment où une demande existe** que ces informations sont montrées, et **uniquement au destinataire de la demande**. Seul ce qui est révélé à ce moment-là change — nom complet et photo en plus de la ville et de l'âge déjà montrés. `dbshema.md` §5 et §3.6 mis à jour en conséquence ("prénom/ville/âge" → "nom complet/photo de profil/ville/âge").

Pas de changement en sens inverse : la fiche logement continue d'afficher uniquement le **prénom** de l'hôte (`getFirstName(host.fullName)`, `/logements/[id]/page.tsx`), y compris pour un festivalier qui a déjà envoyé une demande — hors périmètre de cette demande, non modifié.

### Implémentation

`src/app/logements/demandes/page.tsx` : `getFirstName(guest.fullName)` remplacé par `guest.fullName ?? 'Utilisateur'` ; ajout d'un avatar (photo si `guest.avatarUrl` existe, sinon rond avec l'initiale du nom en repli) — même composant visuel que celui déjà utilisé sur `/compte` et la fiche logement (§9). `guest: users` sélectionne déjà la ligne complète dans la requête existante, aucune colonne ni jointure supplémentaire nécessaire. Import de `getFirstName` retiré du fichier (devenu inutilisé à cet endroit).

### Titre de carte — retour utilisateur

Chaque carte affichait initialement le **titre du logement** en en-tête (`{listing.title}`), suivi du nom du festivalier en dessous. Retour utilisateur : répéter le titre du logement sur chaque carte est inutile — un hôte ne gère qu'un seul logement (`dbshema.md` §4.7), donc c'est systématiquement le même titre sur toutes les cartes de cette page.

Corrigé : l'en-tête devient **« Demande de {nom complet} »**, qui remplace à la fois le titre du logement et l'ancienne ligne de nom séparée en dessous. Ville et âge restent affichés juste en dessous (sur leur propre ligne, seulement si l'un des deux est renseigné — pas de ligne vide sinon), puis le message s'il y en a un. La requête ne sélectionne plus `listings` (devenu inutile pour l'affichage, la jointure reste nécessaire pour filtrer sur `listings.host_id`).

### Validé lors des tests

- ✅ Nom complet ("Sophie Bernard") affiché au lieu du seul prénom, avec la vraie photo de profil du compte de test, sur une demande réelle en base.
- ✅ En-tête "Demande de Sophie Bernard" remplace le titre du logement précédemment répété ; pas de ligne vide quand ville/âge sont absents.
- ✅ `tsc --noEmit` et `eslint` propres.

## 11. Revue sécurité — photo de profil + §10

Revue ciblée (agent dédié + méthodologie du skill `security-review`) sur l'ensemble des fichiers touchés par §9 et §10 : `src/lib/profile/constants.ts`, `src/lib/profile/storage.ts` (nouveaux), `src/lib/profile/actions.ts` (`updateProfileAction`), `src/components/profile/ProfileForm.tsx`, `src/app/compte/page.tsx`, `src/app/logements/[id]/page.tsx`, `src/app/logements/demandes/page.tsx`, `scripts/setup-storage.ts`.

**Résultat : aucune vulnérabilité HIGH/MEDIUM identifiée.** Points vérifiés :

- **Chemin de stockage de l'avatar** : `uploadAvatar(userId, file)` construit le chemin depuis `user.id` (session authentifiée côté serveur, jamais depuis `formData`) + un UUID aléatoire — aucune traversée de chemin ni écriture pour le compte d'un autre utilisateur possible. Même construction que `uploadFestivalCover`/`uploadListingPhoto`.
- **Action serveur `updateProfileAction`** : garde `if (!user) return { error: 'Tu dois être connecté.' }` avant toute opération fichier/BDD ; la mise à jour est bornée par `.where(eq(users.id, user.id))` — aucun appel non authentifié ni IDOR possible sur l'avatar d'un tiers.
- **Provenance de `avatarUrl`** : seule `updateProfileAction` écrit cette colonne, avec l'URL retournée par `uploadAvatar()` (générée côté serveur) ou `null` — jamais une valeur transmise telle quelle par le client, ce qui écarte un vecteur XSS via `src`.
- **XSS** : les trois emplacements d'affichage (page compte, fiche logement, demandes reçues) rendent `fullName`/`avatarUrl`/`city`/`booking.message` en JSX standard (échappement automatique React) — aucun `dangerouslySetInnerHTML` introduit.
- **Frontière d'autorisation sur `/logements/demandes`** : la clause `where(eq(listings.hostId, user.id))` de la requête est inchangée par ce diff — seul l'affichage (nom complet + avatar au lieu du prénom seul) a changé, à l'intérieur du même jeu de lignes déjà correctement filtré. Un hôte ne peut toujours voir que les demandes faites sur son propre logement.
- **Bucket `avatars`** : public et distinct du bucket privé `listing-certification-docs` (qui utilise déjà des URLs signées) — choix cohérent, l'avatar est une donnée destinée à être publique. Types acceptés (`jpeg`/`png`/`webp`, `scripts/setup-storage.ts`) excluent le SVG, écartant un vecteur d'exécution de script via une image.
- **Validation fichier** : type MIME et taille (5 Mo) vérifiés côté serveur (pas seulement côté client) avant l'upload, en plus des contraintes du bucket lui-même — même niveau de rigueur que pour les photos de logement/couvertures de festival.

Point **non retenu comme vulnérabilité** (politique produit assumée, pas un défaut de sécurité) : `src/lib/profile/utils.ts` documentait `getFirstName()` comme "jamais le nom complet dans les contextes publics/inter-utilisateurs" — devenu trompeur puisque §10 expose désormais le nom complet du festivalier à l'hôte destinataire d'une demande. Commentaire mis à jour pour préciser que cette restriction s'applique au sens hôte→festivalier (fiche logement, toujours prénom seul) et non à l'inverse, qui reste gouverné par dbshema.md §5.

Non revérifié ici (hors périmètre de ce diff, déjà couvert par les passes précédentes) : upload de justificatif de domicile (`listings-setup.md` §9/§11), formulaire de contact (`contact-setup.md` §5).

## 12. Date d'arrivée, date de départ et nombre de personnes sur la demande

Demande explicite : qu'un festivalier puisse renseigner sa date d'arrivée, sa date de départ et le nombre de personnes en contactant un hôte — jusque-là le formulaire de demande (`RequestBookingForm.tsx`) ne comportait qu'un message optionnel ; `bookings.guests_count` existait déjà en base mais n'était jamais lu depuis le formulaire (toujours à sa valeur par défaut `1`).

### Modèle retenu — dates déclarées à l'intérieur de la fenêtre du festival, pas une réservation nuit par nuit libre

`dbshema.md` §3.6 documente que "les dates de séjour sont **entièrement dérivées du festival**" (`festival.date_start/date_end` ± `listing_festivals.arrival_buffer_before/after`) — décision MVP volontaire, pas remise en cause ici. Ce chantier n'introduit pas de sélection de nuits libre : le festivalier déclare ses dates prévues d'arrivée/départ **à l'intérieur de cette fenêtre déjà fixée**, validées côté serveur contre elle. C'est de l'information utile pour l'hôte (qui arrive quand, qui repart quand), pas un nouveau moteur de tarification — `bookings.price_agreed` reste non calculé (`dbshema.md` §4.2, toujours "pas encore implémenté").

Les deux champs `arrival_buffer_before`/`arrival_buffer_after` de `listing_festivals` existaient déjà en base depuis le modèle initial mais n'étaient utilisés nulle part dans le code avant ce chantier — c'est exactement leur usage prévu.

### Fichiers ajoutés/modifiés

- [`src/db/schema.ts`](src/db/schema.ts) — `bookings.arrival_date`/`bookings.departure_date` (date, NULL) ; nullable pour ne pas casser les demandes déjà existantes créées avant ce champ (pas de valeur par défaut sensée à leur attribuer rétroactivement)
- [`drizzle/0013_sparkling_loki.sql`](drizzle/0013_sparkling_loki.sql) — migration d'ajout, sans ambiguïté (aucune colonne supprimée en parallèle)
- [`src/lib/bookings/actions.ts`](src/lib/bookings/actions.ts) — `requestBookingAction` lit et valide `arrivalDate`/`departureDate`/`guestsCount` : dates parseables, arrivée ≤ départ, nombre de personnes entier ≥ 1, et **les deux dates doivent tomber dans la fenêtre festival ± buffer** (calculée à partir de `listingFestivals.arrivalBufferBefore/After`) — jamais fait confiance aux bornes `min`/`max` HTML du formulaire, qui ne sont qu'une suggestion au navigateur
- [`src/components/bookings/RequestBookingForm.tsx`](src/components/bookings/RequestBookingForm.tsx) — deux `<input type="date">` (calendrier natif, sans `min`/`max` — voir §12.1) et un `<input type="number">` pour le nombre de personnes (borné par la capacité du logement si connue, sinon repli sur 10)
- [`src/app/logements/[id]/page.tsx`](src/app/logements/[id]/page.tsx) — calcule la fenêtre autorisée (`bookingWindow()`) à partir du festival associé et des buffers, transmise en props au formulaire (bornes utilisées pour le pré-remplissage et le texte d'aide, pas pour restreindre le calendrier — voir §12.1)
- [`src/app/logements/demandes/page.tsx`](src/app/logements/demandes/page.tsx) (vue hôte) et [`src/app/mes-demandes/page.tsx`](src/app/mes-demandes/page.tsx) (vue festivalier) — affichent désormais "Du {arrivée} au {départ} · {N} personne(s)" sur chaque demande ; si `arrival_date`/`departure_date` sont `NULL` (demandes créées avant ce chantier), seule la mention du nombre de personnes s'affiche, pas de ligne de dates vide

### 12.1 Retour utilisateur — sélection de l'année cassée sur le calendrier natif

Retour : "il y a un souci lorsque je souhaite sélectionner l'année sur le calendrier", sur les champs Date d'arrivée/Date de départ.

**Cause** : ces deux `<input type="date">` portaient des attributs `min`/`max` posés sur la fenêtre festival ± buffer — le plus souvent une poignée de jours, toujours à l'intérieur d'une seule et même année. Le calendrier natif du navigateur, une fois positionné sur une autre année, n'y trouve aucune date valide (hors bornes `min`/`max`) et bloque la sélection — vécu comme une année "figée" ou un calendrier qui ne répond pas.

**Première tentative rejetée par l'utilisateur** : remplacer les deux champs par des `<select>` énumérant chaque jour valide (plus de calendrier natif du tout, donc plus de blocage possible). Fonctionnellement correct mais pas le calendrier attendu — retour explicite : "non ça ne me va pas, repasser avec le calendrier du navigateur".

**Corrigé (version retenue)** : retour à `<input type="date">`, mais **sans attributs `min`/`max`** — le calendrier natif redevient entièrement libre, aucune année ne peut plus se retrouver bloquée. `defaultValue` reste pré-rempli aux bornes de la fenêtre (premier/dernier jour), et un texte d'aide sous les champs rappelle explicitement la fenêtre autorisée ("Doit être compris entre le 17 juin et le 22 juin."). La validation serveur dans `requestBookingAction` (déjà en place, indépendante des attributs HTML) reste la seule vraie barrière : une date hors fenêtre est refusée avec un message clair, que le client ait ou non tenté de la bloquer visuellement — cohérent avec le principe déjà appliqué partout ailleurs dans le projet ("un `min`/`max` HTML n'est qu'une suggestion au navigateur, jamais une garantie").

### Non traité dans ce chantier

`bookings.spots_booked` (distinct de `guests_count`, voir `dbshema.md` §3.6 — "nombre de places consommées" pour les types "à places") reste à sa valeur par défaut `1`, indépendamment du nombre de personnes saisi. Pour un logement de type `camping_spot`/`glamping`/`couch`, une demande de groupe de 3 personnes ne consomme donc toujours qu'1 "place" dans le calcul de capacité de `acceptBookingAction` — écart déjà présent avant ce chantier (`spots_booked` n'était déjà lu nulle part depuis un formulaire), non corrigé ici pour rester strictement dans le périmètre demandé (dates + nombre de personnes sur le formulaire de contact). À traiter séparément si le calcul de capacité doit refléter le nombre réel de personnes par demande.

### Comment tester

1. Connecté en festivalier, ouvrir une fiche logement associée à un festival (ex : `/logements/[id]` pour un logement lié à Hellfest)
2. Le formulaire affiche "Date d'arrivée"/"Date de départ" comme deux `<input type="date">` classiques (calendrier natif du navigateur, sans `min`/`max`), pré-remplis aux bornes de la fenêtre, avec un texte d'aide rappelant la fenêtre autorisée ; "Nombre de personnes" pré-rempli à 1 (max = capacité du logement si connue)
3. Ouvrir le calendrier natif et changer l'année librement (aucun blocage, contrairement à l'ancien comportement avec `min`/`max`, §12.1)
4. Modifier les dates/nombre de personnes dans la fenêtre autorisée, envoyer → la demande apparaît sur `/mes-demandes` avec "Du {arrivée} au {départ} · {N} personne(s)"
5. Essayer une date hors fenêtre (ex : bonne date mais mauvaise année) → rejetée côté serveur avec un message explicite, malgré l'absence de `min`/`max` côté client
6. Connecté en hôte sur `/logements/demandes` → la même information apparaît sur la demande reçue

### Validé lors des tests

- ✅ Champs redevenus des `<input type="date">` sans `min`/`max` — vérifié via `element.min`/`element.max` (chaînes vides)
- ✅ Soumission avec une date dans la bonne fenêtre mais la mauvaise année (2027 au lieu de 2026) → refusée côté serveur avec le message "Les dates doivent être comprises entre le 17/06/2026 et le 22/06/2026."
- ✅ Soumission avec des dates valides (18→21 juin 2026) → acceptée, affichée correctement sur `/mes-demandes` ("Du 18 juin au 21 juin · 1 personne") et sur `/logements/demandes` côté hôte
- ✅ Une demande pré-existante (créée avant ce chantier, sans dates) affiche seulement "1 personne", pas de ligne de dates vide ni d'erreur
- ✅ `npx tsc --noEmit` et `npx eslint .` propres
- ✅ Migration `0013` appliquée sans erreur sur la base de dev

## 13. Minimum 2 personnes par demande — fermeture d'un écart déjà documenté

Retour utilisateur : "en tant que festivalier, je ne peux pas réserver pour 1 seule personne" — ferme l'écart explicitement noté comme "non traité" dans `listings-setup.md` §15 : le minimum de festivaliers fixé par l'hôte (`listings.min_guests`, 2 à 10) n'était jusque-là jamais revérifié sur le formulaire de demande, qui acceptait `guestsCount = 1` sans restriction, quel que soit le logement.

### Règle retenue

Le champ "Nombre de personnes" du formulaire de demande (`RequestBookingForm.tsx`) est maintenant borné, pour un logement donné, par :

- **minimum** : `listing.minGuests` (2 à 10, types bloquants) si renseigné, sinon repli sur **2** — aucune demande pour une seule personne n'est plus possible, cohérent avec la borne minimale déjà en place sur `spots_total` pour les types "à places" (§16 de `listings-setup.md`)
- **maximum** : `listing.maxGuests` ou `listing.spotsTotal` (déjà utilisé avant ce chantier), repli sur 10

### Fichiers modifiés

- [`src/lib/bookings/actions.ts`](src/lib/bookings/actions.ts) — `requestBookingAction` calcule `effectiveMinGuests`/`effectiveMaxGuests` à partir du logement chargé (`row.listing`, déjà sélectionné en entier — aucune nouvelle requête) et rejette toute valeur hors de cette plage, avec un message citant les bornes réelles du logement
- [`src/components/bookings/RequestBookingForm.tsx`](src/components/bookings/RequestBookingForm.tsx) — l'input `guestsCount` utilise `minGuests ?? 2` comme `min`/valeur par défaut (au lieu de `1` fixe), avec un texte d'aide ("Minimum N personnes pour ce logement.") quand ce minimum dépasse 1
- [`src/app/logements/[id]/page.tsx`](src/app/logements/%5Bid%5D/page.tsx) — passe `minGuests={listing.minGuests}` en prop supplémentaire au formulaire

### Comment tester

1. Connecté en festivalier sur un logement dont l'hôte a fixé `minGuests = 2` (ex : "Studio indépendant proche Hellfest"), ouvrir la fiche
2. Le champ "Nombre de personnes" démarre à 2, pas à 1, avec le texte d'aide correspondant
3. Forcer `guestsCount = 1` en contournant la validation HTML (requête forgée) → rejetée côté serveur avec le message citant les bornes exactes du logement
4. Une valeur valide (2) est acceptée normalement

### Validé lors des tests

- ✅ Sur "Studio indépendant proche Hellfest" (`minGuests = 2`, `maxGuests = 4`) : champ pré-rempli à 2, texte d'aide affiché
- ✅ Soumission forcée à 1 personne (contournement client) → rejetée : "Le nombre de personnes doit être compris entre 2 et 4 pour ce logement."
- ✅ Soumission à 2 personnes → acceptée, affichée correctement sur `/mes-demandes` et `/logements/demandes`
- ✅ `npx tsc --noEmit` et `npx eslint .` propres

## 14. Message de l'hôte visible par le festivalier à l'acceptation

Demande explicite : "lorsqu'un propriétaire valide ma demande de mise en relation je dois pouvoir voir son message" — jusque-là, seul le refus avait un champ de motif consultable par le festivalier (`rejectionReason`) ; l'acceptation n'avait aucun moyen de transmettre un message (contact, consignes d'arrivée...).

### Fichiers modifiés

- [`src/db/schema.ts`](src/db/schema.ts) — `bookings.acceptance_message` (text, NULL), symétrique de `rejection_reason` mais **optionnel** (contrairement au motif de refus, qui reste requis)
- [`drizzle/0015_lazy_sauron.sql`](drizzle/0015_lazy_sauron.sql) — migration d'ajout simple
- [`src/lib/bookings/actions.ts`](src/lib/bookings/actions.ts) — `acceptBookingAction` lit un champ `message` optionnel et l'enregistre dans `acceptanceMessage`
- [`src/components/bookings/BookingRequestActions.tsx`](src/components/bookings/BookingRequestActions.tsx) — le bouton "Accepter" est accompagné d'un champ texte optionnel ("Message pour le festivalier (optionnel)"), à côté du champ "Motif du refus" déjà requis pour "Refuser"
- [`src/app/mes-demandes/page.tsx`](src/app/mes-demandes/page.tsx) — affiche `« {acceptanceMessage} »` quand le statut est `accepted` et qu'un message a été renseigné
- [`src/app/logements/demandes/page.tsx`](src/app/logements/demandes/page.tsx) — affiche aussi "Ton message : « ... »" côté hôte, par symétrie avec le motif de refus déjà visible sur cette page (confirmation de ce qui a été envoyé, pas juste une info à sens unique)

### Comment tester

1. Festivalier envoie une demande sur un logement
2. Hôte, sur `/logements/demandes` : renseigne un message optionnel puis clique "Accepter"
3. Festivalier, sur `/mes-demandes` : le message de l'hôte apparaît sous le statut "Acceptée"
4. Hôte, en rechargeant `/logements/demandes` : voit aussi son propre message ("Ton message : « ... »")

### Validé lors des tests

- ✅ Demande envoyée (Julie Martin → logement de Léa Rousseau), acceptée avec le message "Bienvenue ! Je t'enverrai le code du portail par SMS la veille."
- ✅ Message affiché correctement sur `/logements/demandes` (vue hôte, juste après acceptation) et sur `/mes-demandes` (vue festivalier)
- ✅ Acceptation sans message (champ laissé vide) ne provoque aucune erreur, aucune ligne de message vide affichée (déjà vérifié implicitement par les tests précédents de ce chantier qui n'utilisaient pas ce champ)
- ✅ `npx tsc --noEmit` et `npx eslint .` propres
- ✅ Migration `0015` appliquée sans erreur sur la base de dev

## 15. Partage explicite de l'email du festivalier à l'acceptation

Demande explicite : "lorsqu'une mise en relation est validée par un hôte, le festivalier est invité à partager son adresse email pour rentrer en contact". Jusque-là, une fois une demande acceptée, rien dans le produit ne permettait concrètement d'établir un contact réel entre hôte et festivalier au-delà du message d'acceptation (§14) — l'email n'était jamais montré à l'hôte, à aucun moment (cohérent avec `dbshema.md` §5, mais laissait le "comment se contacter réellement" non résolu).

### Principe retenu — geste volontaire du festivalier, jamais automatique

Comme le reste du modèle de confidentialité du projet (nom complet/photo/ville/âge déjà révélés à la demande, jamais avant), le partage de l'email **n'est jamais automatique** à l'acceptation — c'est une action que le festivalier choisit de déclencher lui-même, une fois la demande acceptée. Tant qu'il ne clique pas, l'hôte ne voit rien.

### Fichiers modifiés

- [`src/db/schema.ts`](src/db/schema.ts) — `bookings.guest_email_shared` (boolean, `DEFAULT false`)
- [`drizzle/0016_unique_squadron_sinister.sql`](drizzle/0016_unique_squadron_sinister.sql) — migration d'ajout simple
- [`src/lib/bookings/actions.ts`](src/lib/bookings/actions.ts) — nouvelle Server Action `shareGuestEmailAction` : vérifie que l'utilisateur connecté est bien le **festivalier propriétaire de la demande** (`booking.guestId === user.id` — pas `hostId`, contrairement aux actions d'acceptation/refus qui appartiennent à l'hôte) et que le statut est `accepted`, avant de passer `guestEmailShared` à `true`
- [`src/components/bookings/ShareEmailButton.tsx`](src/components/bookings/ShareEmailButton.tsx) (nouveau) — bouton + texte d'explication, affiché uniquement pour une demande `accepted` pas encore partagée
- [`src/app/mes-demandes/page.tsx`](src/app/mes-demandes/page.tsx) — affiche `ShareEmailButton` (email pris depuis la session Supabase du festivalier, jamais transmis par le client) si `accepted` et pas encore partagé, sinon une confirmation "Ton email a été partagé avec l'hôte."
- [`src/app/logements/demandes/page.tsx`](src/app/logements/demandes/page.tsx) — affiche l'email du festivalier (déjà sélectionné via `guest: users`, aucune nouvelle requête) uniquement si `guestEmailShared` est vrai, en lien `mailto:`

### Comment tester

1. Festivalier avec une demande `accepted` → sur `/mes-demandes`, un encart invite à partager son email, avec un bouton
2. Clic sur le bouton → confirmation "Ton email a été partagé avec l'hôte.", le bouton disparaît
3. Hôte, sur `/logements/demandes` → l'email du festivalier apparaît (lien `mailto:`) uniquement pour cette demande précise, pas pour une autre demande acceptée où l'email n'a pas été partagé

### Validé lors des tests

- ✅ Deux demandes `accepted` distinctes du même festivalier (Julie Martin) : partage déclenché sur une seule → confirmation affichée uniquement sur celle-là, l'autre garde son bouton de partage intact
- ✅ Hôte (Léa Rousseau) voit l'email exact du festivalier sur `/logements/demandes`, uniquement pour la demande partagée
- ✅ `npx tsc --noEmit` et `npx eslint .` propres
- ✅ Migration `0016` appliquée sans erreur sur la base de dev

## 16. Délai de 48h pour partager l'email

Demande explicite : ajouter le texte "vous disposez de 48h pour faire parvenir votre email à votre hôte" — implémenté comme un vrai délai (pas seulement un rappel textuel) : passé 48h après l'acceptation, l'action de partage n'est plus proposée.

### Fichiers modifiés

- [`src/lib/bookings/availability.ts`](src/lib/bookings/availability.ts) — `EMAIL_SHARE_WINDOW_HOURS` (48) et `isEmailShareWindowOpen(respondedAt)`, calculée à partir de `bookings.responded_at` (déjà horodaté à l'acceptation par `acceptBookingAction`) ; regroupée avec `isFullyBooked()`, même famille de règles métier partagées entre Server Action et page
- [`src/lib/bookings/actions.ts`](src/lib/bookings/actions.ts) — `shareGuestEmailAction` revérifie la fenêtre côté serveur avant tout partage, indépendamment de ce qu'affiche la page — jamais fait confiance à l'horloge du client
- [`src/app/mes-demandes/page.tsx`](src/app/mes-demandes/page.tsx) — si la demande est `accepted`, pas encore partagée, et la fenêtre est dépassée, affiche "Le délai de 48h pour partager ton email avec l'hôte est dépassé." à la place du bouton
- [`src/components/bookings/ShareEmailButton.tsx`](src/components/bookings/ShareEmailButton.tsx) — ajoute le texte demandé sous l'explication du partage

### Comment tester

1. Sur une demande `accepted` récente (< 48h), le bouton de partage s'affiche avec le texte "Vous disposez de 48h pour faire parvenir votre email à votre hôte."
2. Passé 48h après l'acceptation (`responded_at` + 48h), le bouton disparaît au profit du message d'expiration — vérifié en isolant la fonction `isEmailShareWindowOpen` (même logique que celle utilisée en production) : `true` pour une acceptation vieille de 47h, `false` pour 49h

### Validé lors des tests

- ✅ Texte affiché correctement sur une demande acceptée récente, avant le bouton "Partager mon email avec l'hôte"
- ✅ Logique de fenêtre 48h validée indépendamment (47h → ouverte, 49h → fermée, `null` → fermée par défaut)
- ✅ `npx tsc --noEmit` et `npx eslint .` propres

## 17. Statut de contact côté hôte — email reçu ou en attente

Demande explicite : sur `/logements/demandes`, pour une demande acceptée, afficher "ne tardez pas à contacter le festivalier pour l'organisation" une fois l'email reçu, sinon "en attente de l'email du festivalier".

### Fichier modifié

[`src/app/logements/demandes/page.tsx`](src/app/logements/demandes/page.tsx) — sous la ligne d'email déjà affichée quand `guestEmailShared` est vrai (§15), ajoute "Ne tardez pas à contacter le festivalier pour l'organisation." ; sinon (statut `accepted` mais email pas encore partagé), affiche "En attente de l'email du festivalier." à la place.

### Comment tester

`/logements/demandes`, sur une demande `accepted` : si l'email a été partagé (§15), le message d'incitation apparaît sous l'email ; sinon, le message d'attente s'affiche.

### Validé lors des tests

- ✅ Demande acceptée avec email partagé (Karim Haddad) → "Email du festivalier : ..." suivi de "Ne tardez pas à contacter le festivalier pour l'organisation."
- ✅ Demande acceptée sans email partagé (Sophie Bernard) → "En attente de l'email du festivalier.", aucune ligne d'email affichée
- ✅ `npx tsc --noEmit` et `npx eslint .` propres

## 18. Annulation automatique passé le délai de 48h

Demande explicite : "si le festivalier n'envoie pas son email sous 48h, la mise en relation est annulée et le festivalier en est informé." Jusque-là (§16), le délai de 48h ne faisait que masquer le bouton de partage une fois dépassé — la demande restait `accepted` indéfiniment, sans qu'aucune des deux parties ne soit explicitement informée que la mise en relation était caduque.

### Principe retenu — balayage paresseux, pas de tâche planifiée

Ce projet n'a pas d'infrastructure de tâche planifiée (pas de cron, pas de queue). Plutôt que d'en ajouter une pour ce seul besoin, `expireOverdueAcceptedBookings()` fait un balayage "paresseux" : elle cherche toute demande `accepted` avec `guest_email_shared = false` et `responded_at` antérieur de plus de 48h, et la fait basculer en `cancelled`. Elle est appelée en tête des trois pages où le statut d'une demande compte réellement pour l'utilisateur : `/mes-demandes`, `/logements/demandes`, `/logements/[id]`. Ainsi, dès qu'une des deux parties consulte une de ces pages après l'expiration du délai, la demande est annulée immédiatement avant l'affichage — pas besoin d'attendre une exécution planifiée.

Le statut `cancelled` existait déjà dans `bookingStatusEnum` avec ses libellés déjà câblés dans les 3 pages concernées, mais n'était encore jamais réellement utilisé nulle part — c'est la première fois que cette valeur est effectivement posée en base. Le motif est stocké dans `bookings.rejection_reason`, réutilisant le même champ déjà affiché pour un refus manuel (`status === 'rejected'`), dont l'affichage a été étendu à `status === 'cancelled'`.

### Piège rencontré — `revalidatePath` pendant un rendu

Une première version appelait `revalidateBookingViews()` (qui invoque `revalidatePath()`) à chaque demande annulée par le balayage. Cela provoquait une erreur serveur (page cassée) : `revalidatePath` ne peut être appelé que depuis une Server Action ou un Route Handler, jamais depuis le rendu d'un Server Component — or `expireOverdueAcceptedBookings()` est appelée directement dans le corps de pages (`page.tsx`), pas depuis un `<form action>`. Diagnostic confirmé en isolant la fonction dans un script autonome (hors contexte de rendu Next.js) : la logique de mise à jour en base fonctionnait parfaitement, l'erreur venait uniquement de l'appel à `revalidatePath` en contexte de rendu. Correction : suppression de l'appel à `revalidateBookingViews()` dans cette fonction — inutile de toute façon, puisque les trois pages qui l'appellent relisent des données fraîches juste après (même requête), et sont déjà rendues dynamiquement à chaque requête (lecture de cookies via `supabase.auth.getUser()`).

### Fichiers modifiés

- [`src/lib/bookings/actions.ts`](src/lib/bookings/actions.ts) — nouvelle fonction `expireOverdueAcceptedBookings()` : sélectionne les demandes `accepted` + `guestEmailShared = false` + `respondedAt <= now - 48h`, les bascule en `cancelled` avec un motif fixe, sans appel à `revalidatePath` (voir piège ci-dessus)
- [`src/app/mes-demandes/page.tsx`](src/app/mes-demandes/page.tsx), [`src/app/logements/demandes/page.tsx`](src/app/logements/demandes/page.tsx), [`src/app/logements/[id]/page.tsx`](src/app/logements/%5Bid%5D/page.tsx) — appellent `await expireOverdueAcceptedBookings()` juste après la vérification d'authentification, avant toute lecture des demandes
- Affichage `status === 'cancelled' && rejectionReason` ajouté sur `/mes-demandes` et `/logements/demandes` (déjà présent sur `/logements/[id]` sous une forme générique)

### Comment tester

Un vrai test en conditions réelles demanderait d'attendre 48h après l'acceptation d'une demande — non praticable. À la place : insertion directe en base d'une demande `accepted` avec `responded_at` daté de 49h dans le passé et `guest_email_shared = false` (script temporaire, supprimé après usage), puis chargement des trois pages concernées pour vérifier (a) l'absence de crash et (b) le changement de statut effectif en `cancelled` avec le bon motif.

### Validé lors des tests

- ✅ Reproduction du crash `revalidatePath` confirmée avant correctif (chargement de `/mes-demandes` avec une demande en retard → erreur serveur générique)
- ✅ Isolation de `expireOverdueAcceptedBookings()` hors contexte de rendu : la mise à jour en base réussit sans erreur, prouvant que le problème était bien localisé à `revalidatePath`
- ✅ Après correctif : `/mes-demandes`, `/logements/demandes` et `/logements/[id]` se chargent sans erreur avec une demande en retard présente, et affichent "Annulée" + le motif attendu
- ✅ `npx tsc --noEmit`, `npx eslint .` et `npx prettier --write` propres
- ✅ Données de test (demandes synthétiques et scripts temporaires) supprimées après vérification
