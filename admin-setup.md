# Dashboard admin — Journal d'implémentation

> Documente la mise en place du back-office d'administration, en complément de [`dbshema.md`](dbshema.md) (modèle de données), [`db-setup.md`](db-setup.md) (base de données) et [`auth-setup.md`](auth-setup.md) (authentification).

---

## 1. Stack et décisions

- **Identification admin** : champ `users.role` (`user` | `admin`, défaut `user`) — voir `dbshema.md` §3.1. Choisi plutôt que les métadonnées Supabase (`app_metadata`) ou une liste blanche d'emails en variable d'env, pour rester cohérent avec le reste du schéma (interrogeable directement via Drizzle).
- **Périmètre v1** : modération des logements + gestion des hôtes + gestion des festivals (CRUD complet — le dashboard devient l'unique interface de création/édition des festivals, qui n'étaient jusque-là que seedés via script).
- **Accès** : uniquement via URL directe `/admin`, pas de lien dans le `Header` — protection assurée côté serveur (pas par l'obscurité).

## 2. Fichiers créés

| Fichier                                                                                                                                      | Rôle                                                                                              |
| -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `src/lib/auth/admin.ts`                                                                                                                      | `requireAdmin()` — vérifie session + `role === 'admin'`, redirige sinon (`/connexion` ou `/`)     |
| `src/app/admin/layout.tsx`                                                                                                                   | Layout protégé (appelle `requireAdmin()`), nav Logements / Hôtes / Festivals                      |
| `src/app/admin/page.tsx`                                                                                                                     | Redirige vers `/admin/logements`                                                                  |
| `src/app/admin/logements/page.tsx` + `src/lib/admin/listings-actions.ts`                                                                     | Modération : filtre par statut, `approveListingAction`, `rejectListingAction` (avec motif)        |
| `src/app/admin/hotes/page.tsx` + `src/lib/admin/hosts-actions.ts`                                                                            | Liste des hôtes (nb de logements), `suspendHostAction`/`reactivateHostAction` (ban Supabase Auth) |
| `src/app/admin/festivals/{page,nouveau/page,[id]/page}.tsx` + `src/components/admin/FestivalForm.tsx` + `src/lib/admin/festivals-actions.ts` | CRUD festivals (création/édition, formulaire réutilisé pour les deux)                             |
| `drizzle/0002_*.sql`                                                                                                                         | Migration ajoutant `users.role`                                                                   |
| `drizzle/0003_*.sql`                                                                                                                         | Migration `ON DELETE SET NULL` sur `festivals.created_by` / `listings.reviewed_by` (voir §4.3)    |

## 3. Point d'architecture important : protection au niveau Server Action, pas seulement page

Le layout `src/app/admin/layout.tsx` protège l'affichage des pages via `requireAdmin()`, **mais une Server Action reste appelable directement, indépendamment de la page qui l'a rendue** — ce n'est pas parce qu'une page est protégée que les actions qu'elle expose le sont automatiquement. Chaque Server Action des sections `/admin` (`approveListingAction`, `rejectListingAction`, `suspendHostAction`, `reactivateHostAction`, `createFestivalAction`, `updateFestivalAction`) appelle donc `requireAdmin()` en première ligne, indépendamment du layout. Documenté aussi en commentaire dans `src/lib/auth/admin.ts`.

## 4. Bugs rencontrés et corrigés

### 4.1 `A "use server" file can only export async functions, found object`

Même bug que celui déjà rencontré côté auth (`auth-setup.md` §7.1) : `festivals-actions.ts` exportait initialement `initialFestivalActionState`, une constante objet, en plus des Server Actions. Supprimé — `FestivalForm.tsx` initialise directement l'état via `useActionState(action, { error: null })` sans dépendre d'une constante partagée. Seul le **type** `FestivalActionState` reste exporté depuis le fichier `"use server"` (les exports de type sont erasés à la compilation, autorisés contrairement aux exports de valeur).

### 4.2 Épuisement des connexions Postgres (`remaining connection slots are reserved for roles with the SUPERUSER attribute`)

**Cause** : en dev, Turbopack réévalue `src/db/client.ts` à chaque hot-reload d'un fichier qui l'importe, même transitivement. Sans mémorisation, chaque modification de fichier recréait une nouvelle connexion Postgres (`postgres()`) sans jamais fermer les précédentes. Sur une session avec de nombreuses éditions (toute la construction du dashboard admin), le quota de connexions du plan gratuit Supabase a fini par être atteint — `npm run db:seed` ne pouvait plus se connecter du tout.

**Correctif** : mémorisation du client Postgres sur `globalThis` dans `src/db/client.ts`, préservée entre les hot-reloads (pattern standard pour tout client DB en Next.js dev — le même problème existe avec Prisma et se corrige pareil). Un redémarrage du serveur de dev a aussi été nécessaire une fois pour libérer les connexions déjà bloquées côté Supabase (le correctif empêche la récidive, mais ne ferme pas rétroactivement les connexions déjà ouvertes).

**Enseignement** : tout client DB avec état (pool de connexions) instancié au niveau module doit être mis en cache sur `globalThis` en dev dans un projet Next.js — sans quoi HMR le recrée à chaque sauvegarde de fichier.

### 4.3 Contrainte FK bloquante sur les champs d'attribution

**Symptôme** : `update or delete on table "users" violates foreign key constraint "festivals_created_by_users_id_fk"` lors du nettoyage idempotent du seed (`scripts/seed.ts` supprime les users de test avant de les recréer).

**Cause** : `festivals.created_by` et `listings.reviewed_by` n'avaient pas de règle `ON DELETE` explicite (donc `NO ACTION` par défaut) — logique pour `host_id`/`guest_id` (propriété réelle, cascade voulue), mais pas pour ces deux champs qui ne font qu'**attribuer** une action à un admin, sans relation de possession.

**Correctif** : passés en `ON DELETE SET NULL` (migration `0003_*.sql`) — supprimer un compte admin n'efface plus les festivals/logements qu'il a créés/modérés, le champ passe simplement à `NULL`. Répercuté dans `dbshema.md` §3.2/§3.3.

## 5. Comment tester

```bash
npm run dev
```

1. Se connecter sur [`/connexion`](http://localhost:3000/connexion) avec `admin@festcamp.test` / `test1234` (voir `auth-setup.md` pour la liste complète des comptes de seed)
2. Aller sur [`/admin`](http://localhost:3000/admin) → redirige vers `/admin/logements`
3. Vérifier la protection : se connecter avec un compte non-admin (ex: `host1@festcamp.test`) et tenter d'aller sur `/admin` → doit rediriger vers `/`

## 6. Points de vigilance non résolus

- `src/app/admin/hotes/page.tsx` appelle `admin.auth.admin.listUsers({ perPage: 1000 })` à chaque chargement de page pour récupérer le statut de suspension — un seul appel API (pas de N+1 par hôte), mais à revoir si la base d'utilisateurs dépasse largement 1000 comptes (pagination non gérée).
- Suspendre un hôte (`ban_duration`) bloque ses futures connexions via Supabase Auth, mais **n'invalide pas une session déjà active** tant que son token JWT n'a pas expiré/été rafraîchi — pas un problème à l'échelle du MVP, à garder en tête si la fenêtre de session devient longue.

## 7. Upload d'image de couverture pour les festivals

Le champ "URL image de couverture" (texte libre) du formulaire festival est remplacé par un vrai sélecteur de fichier — mêmes principes que l'upload de photos de logement (`listings-setup.md` §4), appliqués à un **fichier unique** plutôt qu'à une liste.

### Fichiers ajoutés/modifiés

| Fichier                                 | Rôle                                                                                                                                                                                                         |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/lib/festivals/constants.ts`        | `FESTIVAL_COVERS_BUCKET`, `MAX_COVER_SIZE_BYTES` (5 Mo), `ALLOWED_COVER_TYPES` (JPEG/PNG/WEBP) — même séparation constantes/storage que pour les logements, pour ne rien exposer de serveur au bundle client |
| `src/lib/festivals/storage.ts`          | `uploadFestivalCover(festivalId, file)` — upload vers Supabase Storage, chemin `${festivalId}/${uuid()}.${extension}`, extension dérivée de `file.type` (jamais d'un nom de fichier client)                  |
| `src/lib/admin/festivals-actions.ts`    | `parseFestivalForm()` valide désormais aussi le fichier (type/taille) ; `createFestivalAction`/`updateFestivalAction` uploadent et fixent `coverImageUrl`                                                    |
| `src/components/admin/FestivalForm.tsx` | Sélecteur de fichier avec aperçu (`URL.createObjectURL`), affichage de l'image existante en édition avec option "Supprimer l'image"                                                                          |
| `scripts/setup-storage.ts`              | Généralisé pour provisionner plusieurs buckets (`listing-photos` + `festival-covers`) au lieu d'un seul, de façon toujours idempotente                                                                       |

### Bucket

`festival-covers` — public en lecture, 5 Mo max, JPEG/PNG/WEBP uniquement (même config Storage que `listing-photos`, restriction de type appliquée aussi bien côté application que côté bucket).

### Mise à jour partielle plutôt qu'URL transmise par le client

Sur `updateFestivalAction`, si aucun nouveau fichier n'est envoyé et que la suppression n'est pas demandée, `coverImageUrl` **n'est pas inclus** dans le `.set()` de la requête — la colonne reste inchangée en base. Volontaire : le formulaire ne transmet jamais l'URL de l'image existante en clair pour "la garder", afin de ne jamais faire confiance à une valeur client pour une donnée qui doit rester sous contrôle serveur.

### Modèle d'autorisation : admin global, pas par créateur

Contrairement à `updateListingAction` (qui vérifie `existing.hostId === user.id`, un logement appartenant à un hôte précis), `updateFestivalAction` ne vérifie que `requireAdmin()` — cohérent avec le modèle existant : les festivals sont gérés par **n'importe quel admin**, pas seulement celui qui les a créés (`created_by` est un champ d'attribution informatif, pas une relation de propriété exclusive — voir `dbshema.md` §3.2 et §4.3 de ce document).

### Comment tester

```bash
npm run storage:setup   # provisionne aussi le nouveau bucket festival-covers
npm run dev
```

1. Connecté en admin, [`/admin/festivals/nouveau`](http://localhost:3000/admin/festivals/nouveau) → choisir une image → aperçu affiché → créer
2. Rouvrir le festival en édition → l'image uploadée s'affiche, avec un lien "Supprimer l'image"
3. Supprimer l'image et enregistrer → `cover_image_url` repasse à `NULL` en base

### Validé lors des tests

- ✅ Création avec upload réel (fichier injecté programmatiquement, vérifié directement en base : URL Supabase Storage correcte, chemin scopé par `festivalId`).
- ✅ Suppression de l'image existante en édition → `cover_image_url` bien remis à `NULL`, sans toucher aux autres champs.
- ✅ `tsc`/`eslint`/`prettier` clean.
- ✅ Revue sécurité dédiée effectuée sur ce diff : aucune vulnérabilité HIGH/MEDIUM confirmée (validation de type/taille bien appliquée côté serveur, dérivation d'extension sûre, pas de traversée de chemin possible, `requireAdmin()` appelé avant tout upload).

### Limite connue — image supprimée non nettoyée du Storage

Même limite que pour les photos de logement (`listings-setup.md` §8) : quand une image de couverture est supprimée ou remplacée, le fichier reste dans le bucket Supabase Storage (orphelin, pas de fuite de données). Pas traité pour le MVP.

## 8. Suppression d'un festival

Demande explicite : pouvoir supprimer définitivement un festival depuis l'administration.

### Fichiers ajoutés/modifiés

| Fichier                                         | Rôle                                                                                                                             |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/admin/festivals-actions.ts`            | `deleteFestivalAction` — `requireAdmin()` puis `db.delete(festivals).where(eq(festivals.id, id))`                                |
| `src/components/admin/DeleteFestivalButton.tsx` | Composant client — bouton dans un `<form>` dédié, confirmation via `window.confirm()` avant l'envoi (`e.preventDefault()` sinon) |
| `src/app/admin/festivals/[id]/page.tsx`         | "Zone de danger" ajoutée sous le formulaire d'édition, avec le bouton de suppression                                             |

### Pourquoi un `<form>` séparé plutôt qu'un bouton dans `FestivalForm`

`FestivalForm` est un unique `<form action={formAction}>` partagé par la création et l'édition (voir §7) — imbriquer un second `<form>` de suppression à l'intérieur serait du HTML invalide. Le bouton de suppression vit donc dans son propre `<form>`, rendu directement par la page d'édition (`admin/festivals/[id]/page.tsx`), pas par `FestivalForm` — qui reste ainsi inchangé et toujours utilisable tel quel pour la création (où il n'y a de toute façon rien à supprimer).

### Ce que la suppression entraîne (cascade)

`festivals.id` est référencé par `listing_festivals.festival_id` en `ON DELETE CASCADE` (voir `dbshema.md` §3.5), qui cascade lui-même vers `bookings` puis `reviews` (`ON DELETE CASCADE` en chaîne, voir `src/db/schema.ts`). Supprimer un festival supprime donc aussi :

- les associations logement ↔ festival pour ce festival,
- les demandes de mise en relation (`bookings`) passées via ces associations,
- les avis (`reviews`) qui en découlent.

**Les logements eux-mêmes ne sont jamais supprimés** — un logement existe indépendamment des festivals auxquels il est associé (`dbshema.md` §3.3/§3.5), seule l'association avec CE festival disparaît. Le message de confirmation côté client rappelle cette cascade avant tout envoi, pour qu'un admin ne supprime pas un festival sans en mesurer la portée.

Le fichier de couverture (Storage) n'est pas nettoyé à la suppression — même limite déjà acceptée pour le remplacement/suppression d'une image de couverture (§7, "Limite connue" ci-dessus), pas une incohérence nouvelle.

### Modèle d'autorisation

Identique au reste des actions festival (§7) : `requireAdmin()` seul, pas de vérification par créateur — n'importe quel admin peut supprimer n'importe quel festival.

### Comment tester

1. Connecté en admin, ouvrir un festival en édition (`/admin/festivals/[id]`)
2. Tout en bas du formulaire : section "Zone de danger" avec le bouton "Supprimer ce festival"
3. Cliquer → une boîte de confirmation du navigateur rappelle la cascade (associations/demandes/avis) → annuler ne fait rien, confirmer supprime le festival et redirige vers `/admin/festivals`

### Validé lors des tests

- ✅ Festival de test créé puis supprimé via le bouton — disparaît bien de la liste admin, redirection vers `/admin/festivals` confirmée
- ✅ Annulation de la confirmation navigateur → le formulaire ne se soumet pas, festival non supprimé
- ✅ `npx tsc --noEmit` et `npx eslint .` propres

## 9. Nombre de logements associés à un festival

Demande explicite : qu'un admin voie le nombre de logements associés à un festival.

Affiché à deux endroits, tous deux comptant **tous les logements associés, quel que soit leur statut** (`draft`/`pending_review`/`published`/`rejected`/`archived`) et sans filtrer sur `listingFestivals.isActive` — vue de gestion admin, volontairement différente du compteur public de `FestivalCard.tsx`/`src/app/page.tsx` qui, lui, ne compte que les logements publiés et actifs réellement réservables :

- **Liste des festivals** (`src/app/admin/festivals/page.tsx`) — une ligne "X logement(s) associé(s)" sous les catégories de chaque festival. Calculé en une seule requête (`select festivalId from listingFestivals`) puis compté en mémoire par festival, même approche que `listingCountByFestivalId` sur la page d'accueil.
- **Page d'édition** (`src/app/admin/festivals/[id]/page.tsx`) — même compteur sous le titre, via `count(listingFestivals.id)` filtré sur ce festival (`drizzle-orm`, même pattern que `listingCount` dans `admin/hotes/page.tsx`). Réutilisé aussi dans le texte de la "Zone de danger" (§8) pour rendre concret le nombre d'associations qui seraient supprimées en cascade.

### Comment tester

`/admin/festivals` → chaque festival affiche son nombre de logements associés ; ouvrir un festival en édition → même chiffre affiché sous le titre et dans la Zone de danger.

### Validé lors des tests

- ✅ "Fusion Festival" (1 logement associé) et "Hellfest" 2026 (2 logements associés) : chiffres corrects sur la liste ET la page d'édition, cohérents avec les logements réellement associés en base
- ✅ Festivals sans logement associé : "Aucun logement associé", pas de division par zéro ni d'affichage vide
- ✅ `npx tsc --noEmit` et `npx eslint .` propres

## 10. Revue sécurité — suppression de festival + comptage de logements

Revue ciblée (agent dédié + méthodologie du skill `security-review`) sur §8 (suppression) et §9 (comptage), en particulier la suppression qui est l'action la plus sensible ajoutée depuis la dernière revue.

**Résultat : aucune vulnérabilité HIGH/MEDIUM identifiée.** Points vérifiés :

- **`deleteFestivalAction`** : `requireAdmin()` en toute première ligne, identique en position et en comportement à `createFestivalAction`/`updateFestivalAction` — un appel direct à cette Server Action (en contournant l'UI) sans session admin valide ne peut pas atteindre le `db.delete(...)`. Même modèle d'autorisation que le reste ("n'importe quel admin", pas de vérification par créateur) — pas de régression, pas de durcissement inattendu.
- **`id` transmis au delete** : passe par `eq(festivals.id, id)` (requête paramétrée Drizzle) — aucune concaténation SQL brute. Un UUID malformé ne correspond simplement à aucune ligne, pas un vecteur d'injection.
- **Portée de la cascade** : confirmée dans `src/db/schema.ts` — `listing_festivals.festival_id → festivals.id`, `bookings.listing_festival_id → listing_festivals.id` et `reviews.booking_id → bookings.id` sont toutes en `ON DELETE CASCADE`. La suppression s'arrête à `reviews` ; **`listings` n'est référencé nulle part par `festivals`**, seule la ligne d'association `listing_festivals` disparaît — les logements eux-mêmes ne sont jamais supprimés, conforme à l'intention documentée en §8.
- **Confirmation navigateur** : `window.confirm()`/`e.preventDefault()` dans `DeleteFestivalButton.tsx` est un garde-fou UX, pas une frontière de sécurité — même si un script contournait ce dialogue et soumettait le formulaire directement, `requireAdmin()` côté serveur reste le seul point d'application réel et ne peut pas être contourné depuis le client.
- **Requêtes de comptage** (§9) : lectures agrégées seules, protégées par la protection déjà en place au niveau du layout `/admin` (`requireAdmin()`), aucune nouvelle entrée utilisateur non validée au-delà de l'`id` de festival déjà couvert par les revues précédentes.

## 11. Visibilité admin — arrivée avant / départ après le festival

Demande explicite : qu'un admin voie, sur `/admin/logements`, si l'hôte autorise l'arrivée la veille et le départ le lendemain du festival (choix "Disponibilité" du formulaire logement, `listings-setup.md` §14), ou si le logement n'est disponible que pendant les dates strictes du festival.

### Fichier modifié

[`src/app/admin/logements/page.tsx`](src/app/admin/logements/page.tsx) — la requête `festivalAssociations` sélectionne désormais aussi `listingFestivals.arrivalBufferBefore`/`arrivalBufferAfter` (déjà en base, juste pas encore lus ici) ; le bloc "Festival associé" affiche une ligne supplémentaire :

- "Arrivée la veille et départ le lendemain autorisés" si l'un des deux buffers est `> 0`
- "Disponible uniquement pendant les dates du festival" sinon

Pas de nouvelle requête : `listingFestivals` était déjà jointe pour la distance/navette, seules deux colonnes de plus sont sélectionnées.

### Comment tester

`/admin/logements` → chaque logement associé à un festival affiche la ligne de disponibilité sous la ligne distance/navette, cohérente avec ce que l'hôte a choisi sur son propre formulaire (`listings-setup.md` §14).

### Validé lors des tests

- ✅ Logements avec "± 1 jour" → "Arrivée la veille et départ le lendemain autorisés" affiché
- ✅ Logement avec "Uniquement pendant les dates du festival" → message alternatif affiché correctement, aucune confusion entre les deux
- ✅ `npx tsc --noEmit` et `npx eslint .` propres
