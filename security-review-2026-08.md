# Revue de sécurité globale — 21 août 2026

> Passe de sécurité sur l'ensemble de l'application (pas un diff ponctuel comme les revues déjà
> effectuées après chaque lot de fonctionnalités, référencées ci-dessous). Objectif : vérifier que
> les principes déjà établis dans le projet (validation serveur systématique, contrôle de
> propriété sur chaque ressource, confidentialité par défaut) sont bien respectés partout, pas
> seulement sur les zones récemment modifiées.

## Portée

Tout le code sous `src/` : Server Actions (`lib/*/actions.ts`), Route Handlers, pages (App
Router), composants client, middleware, clients Supabase, schéma Drizzle, configuration
(variables d'environnement, `next.config.ts`). Complète les revues déjà faites sur des diffs
ciblés : `listings-setup.md` §13, `contact-setup.md` §5, `festival-detail-setup.md` §7,
`admin-setup.md` §10, `festival-categories-setup.md` §10, `booking-requests-setup.md` §11.

## Méthodologie

Lecture exhaustive de chaque Server Action et Route Handler, avec vérification systématique de
sept axes : authentification, autorisation/propriété (IDOR), validation serveur des entrées,
injection (SQL, en-têtes), XSS, gestion des secrets/fichiers, et logique métier (bornes,
fenêtres temporelles). En complément : `npm audit` sur les dépendances de production.

## Résultat

**Aucune vulnérabilité HIGH ou MEDIUM identifiée.** Le projet suit de façon cohérente les mêmes
principes défensifs sur l'ensemble du code, pas seulement sur les zones les plus récentes.

## Points vérifiés

### 1. Authentification et sessions

- [`src/middleware.ts`](src/middleware.ts) + [`src/lib/supabase/middleware.ts`](src/lib/supabase/middleware.ts) : rafraîchissement de session à chaque requête, matcher excluant uniquement les assets statiques — pas de route applicative oubliée.
- [`src/lib/auth/actions.ts`](src/lib/auth/actions.ts) : inscription/connexion/déconnexion délèguent entièrement à Supabase Auth (hash de mot de passe, confirmation email) — aucune logique de mot de passe maison.
- Pas de limite de tentatives de connexion (rate limiting) — limitation déjà connue et acceptée pour ce stade du projet (cohérent avec l'absence de rate limiting sur `/contact`, voir `contact-setup.md` §1), pas une régression.

### 2. Autorisation admin

- [`src/lib/auth/admin.ts`](src/lib/auth/admin.ts) : `requireAdmin()` vérifie le rôle en base (`users.role`), pas une simple liste blanche d'emails en variable d'env.
- [`src/app/admin/layout.tsx`](src/app/admin/layout.tsx) : appelle `requireAdmin()`, protège donc automatiquement toutes les pages `/admin/*` qu'il englobe.
- **Chaque Server Action et Route Handler sous `/admin`** rappelle `requireAdmin()` explicitement, sans compter sur la protection du layout (qui ne s'applique qu'aux pages, jamais aux Server Actions appelables directement) : vérifié dans [`lib/admin/festivals-actions.ts`](src/lib/admin/festivals-actions.ts), [`lib/admin/hosts-actions.ts`](src/lib/admin/hosts-actions.ts), [`lib/admin/listings-actions.ts`](src/lib/admin/listings-actions.ts), et [`app/admin/logements/[id]/justificatif/route.ts`](src/app/admin/logements/%5Bid%5D/justificatif/route.ts).

### 3. Propriété des ressources (IDOR)

Chaque action qui lit ou modifie une ressource par son id revérifie que l'utilisateur connecté en est bien le propriétaire, jamais seulement l'authentification :

- `updateListingAction` : `existing.hostId !== user.id` avant toute modification ([lib/listings/actions.ts:331](src/lib/listings/actions.ts#L331)).
- `acceptBookingAction`/`rejectBookingAction` : `row.listing.hostId !== user.id` (l'hôte du logement concerné, pas n'importe quel hôte).
- `shareGuestEmailAction` : `row.booking.guestId !== user.id` — cette action appartient au festivalier, pas à l'hôte, et le code le documente explicitement pour ne pas confondre avec le pattern `hostId` des actions voisines.
- `/logements/[id]/modifier`, `/compte` : chargent la ressource puis vérifient la propriété avant tout rendu (`notFound()` sinon), pas de fuite d'existence d'une fiche d'un autre hôte.

### 4. Validation serveur des entrées

Aucune borne n'est appliquée uniquement côté client. Vérifié systématiquement re-validé serveur : bornes de capacité (2 à 10) dans `parseListingForm`, fenêtre de séjour (dates du festival ± buffer) dans `requestBookingAction`, filtres de `/festivals/[slug]` (type contre l'enum, nombre de personnes 1–10) recalculés côté serveur indépendamment des attributs `min`/`max` HTML ou d'une query string modifiée à la main.

### 5. Injection

- Toutes les requêtes passent par Drizzle avec des valeurs paramétrées — aucune concaténation de chaîne SQL avec une entrée utilisateur, y compris dans les filtres dynamiques de `/festivals/[slug]`.
- Toute valeur censée appartenir à un enum (catégories de festival, type de logement, filtre) est vérifiée par allow-list contre `*.enumValues` avant usage, jamais transmise telle quelle.
- `EMAIL_PATTERN` dans [`lib/contact/actions.ts`](src/lib/contact/actions.ts) exclut `?`/`&` spécifiquement pour empêcher une injection de paramètres dans le lien `mailto:` généré ensuite sur `/admin/messages`.

### 6. XSS

Aucun `dangerouslySetInnerHTML`, `eval`, ni `new Function` dans tout `src/` (vérifié par recherche exhaustive). Tout le contenu utilisateur (messages, descriptions, noms) passe par l'échappement JSX standard.

### 7. Secrets et fichiers

- `SUPABASE_SERVICE_ROLE_KEY` déclarée uniquement côté `server` dans [`config/env.ts`](src/config/env.ts) (validation Zod), jamais préfixée `NEXT_PUBLIC_`.
- `createAdminClient()` (bypass RLS) n'est importé que depuis des fichiers serveur (Server Actions, Route Handlers, Server Components) — vérifié qu'aucun fichier l'importateur n'a la directive `'use client'`.
- Upload de fichiers (photos, justificatifs, avatars, couvertures de festival) : type MIME et taille revérifiés côté serveur avant tout upload, jamais fait confiance à l'`accept` HTML seul.
- Justificatif de domicile : bucket Storage privé, jamais d'URL publique — uniquement une URL signée de 60s générée à la demande, derrière `requireAdmin()`.
- `npm audit --omit=dev` : 0 vulnérabilité.

### 8. Redirections

Aucune redirection (`redirect()`/`NextResponse.redirect()`) ne construit sa destination à partir d'une entrée utilisateur — toutes les cibles sont des chemins statiques, sauf la redirection vers l'URL signée du justificatif (générée côté serveur à partir d'un chemin Storage, pas d'un paramètre de requête). Pas de redirection ouverte possible.

## Limitations connues, déjà acceptées (pas des vulnérabilités)

Rappel de choix déjà documentés ailleurs, à ne pas reproduire comme "nouveaux risques" :

- Pas de rate limiting sur `/contact`, `/connexion`, `/inscription` (`contact-setup.md` §1) — acceptable pour la volumétrie actuelle du MVP, à revoir avant une montée en charge réelle.
- Pas de nettoyage des fichiers Storage orphelins pour les photos remplacées/supprimées côté logement (`listings-setup.md` §8) — le justificatif de domicile fait exception (nettoyé activement, données personnelles).
- Photos de logement et avatars servis depuis des buckets Storage **publics** avec chemin en UUID aléatoire — accessible à quiconque connaît l'URL exacte, y compris pour un logement encore `pending_review`. Cohérent avec la nature non sensible de ces images (contrairement au justificatif, gardé privé) ; à garder en tête si le type de contenu évolue.
