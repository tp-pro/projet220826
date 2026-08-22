# Mon Starter Next.js

Starter réutilisable basé sur Next.js 16 (App Router, Turbopack), TypeScript, Tailwind CSS v4, avec variables d'environnement typées et validées.

## Stack

- **Next.js 16** — App Router, Turbopack (bundler par défaut, aucune config requise)
- **TypeScript** — mode strict
- **Tailwind CSS v4** — configuration CSS-first (pas de `tailwind.config.js`)
- **ESLint 9** (flat config) + **Prettier** — sans conflit entre les deux
- **Zod** + **@t3-oss/env-nextjs** — variables d'environnement typées et validées au démarrage

## Démarrage rapide

```bash
npm install
cp .env.example .env.local
# Remplir .env.local avec vos propres valeurs
npm run dev
```

Ouvrez [http://localhost:3000](http://localhost:3000).

## Structure du projet

```
src/
├── app/                # Routes (App Router), layouts, pages
├── components/
│   ├── ui/              # Composants génériques réutilisables
│   └── layout/           # Header, Footer, composants structurels
├── config/              # Configuration (env.ts, site.ts)
├── db/                  # Schéma Drizzle + client Postgres (voir dbshema.md)
├── lib/                 # Fonctions utilitaires (dont lib/supabase, lib/auth — voir auth-setup.md)
├── hooks/                # Hooks React personnalisés
└── types/                # Types TypeScript partagés
```

⚠️ `public/` reste à la racine du projet, **pas** dans `src/`.

## Base de données

PostgreSQL (hébergé sur [Supabase](https://supabase.com), extension PostGIS activée) via **Drizzle ORM**.

- Schéma : [`src/db/schema.ts`](src/db/schema.ts)
- Client : [`src/db/client.ts`](src/db/client.ts) — importer `db` depuis `@/db`
- Documentation complète du modèle de données (entités, règles métier, décisions produit) : [`dbshema.md`](dbshema.md)

Configuration : créer un projet Supabase, activer PostGIS (`Database > Extensions`), puis renseigner `DATABASE_URL` dans `.env.local` (chaîne de connexion "Transaction pooler", `Project Settings > Database`).

| Commande              | Rôle                                                                     |
| --------------------- | ------------------------------------------------------------------------ |
| `npm run db:generate` | Génère un fichier de migration SQL à partir du schéma                    |
| `npm run db:migrate`  | Applique les migrations en attente sur la base                           |
| `npm run db:push`     | Pousse le schéma directement sans fichier de migration (pratique en dev) |
| `npm run db:studio`   | Ouvre Drizzle Studio (explorateur de données)                            |

## Authentification & données de test

**Supabase Auth** (email + mot de passe, confirmation email active) via `@supabase/ssr`.

- Pages : `/inscription`, `/connexion`, `/compte` (protégée)
- Documentation complète (architecture, variables d'env, comptes de test, pièges rencontrés) : [`auth-setup.md`](auth-setup.md)

```bash
npm run db:seed   # génère festivals/logements/comptes de test fictifs (voir auth-setup.md §5)
```

## Dashboard admin

Modération des logements, gestion des hôtes et CRUD des festivals — accessible uniquement via URL directe (pas de lien dans la navigation), protégé côté serveur par le rôle `admin`.

- Accès : [`/admin`](http://localhost:3000/admin) (compte de seed `admin@festcamp.test`)
- Documentation complète : [`admin-setup.md`](admin-setup.md)

## Création de logement (côté hôte)

Formulaire de publication d'un logement (`/logements/nouveau`), avec upload de photos vers Supabase Storage. Un hôte ne gère qu'**un seul logement** : `/logements/nouveau` redirige vers `/logements/<id>/modifier` s'il en a déjà un.

- Accès : [`/logements/nouveau`](http://localhost:3000/logements/nouveau) (connecté)
- Documentation complète : [`listings-setup.md`](listings-setup.md)

```bash
npm run storage:setup   # provisionne le bucket Supabase Storage des photos de logement
```

## Consultation des logements par festival (côté festivalier)

Depuis la page d'accueil, cliquer sur un festival ouvre sa page détail avec ses logements publiés, filtrables par type, nombre de personnes et navette disponible.

- Accès : cliquer sur une card festival sur [`/`](http://localhost:3000) (connecté)
- Documentation complète : [`festival-detail-setup.md`](festival-detail-setup.md)

## Catégories de festival

Chaque festival peut être marqué avec une ou plusieurs catégories fixes (Musique, Littéraire, Événementiel, Culturel) — cumulables, ex : un festival peut être à la fois événementiel et culturel. Géré depuis le back-office admin. La page d'accueil met en avant les festivals de musique et littéraires dans des sections dédiées, chacune avec un lien vers une page listant tous les festivals de la catégorie.

- Accès : [`/admin/festivals/[id]`](http://localhost:3000/admin/festivals) (admin) · [`/festivals/musique`](http://localhost:3000/festivals/musique) · [`/festivals/litteraire`](http://localhost:3000/festivals/litteraire)
- Documentation complète : [`festival-categories-setup.md`](festival-categories-setup.md)

## Mise en relation hôte ↔ festivalier

Aucune coordonnée n'est affichée publiquement. Un festivalier envoie une demande de mise en relation depuis une fiche logement ; l'hôte consulte ses infos non confidentielles (nom complet, photo de profil, ville, âge) et accepte ou refuse (avec motif). Une fois acceptée, le festivalier est invité à partager volontairement son email pour que l'hôte puisse le contacter — il dispose de 48h pour le faire, faute de quoi la mise en relation est annulée automatiquement et il en est informé.

- Accès festivalier : [`/mes-demandes`](http://localhost:3000/mes-demandes) — accès hôte : [`/logements/demandes`](http://localhost:3000/logements/demandes)
- Documentation complète : [`booking-requests-setup.md`](booking-requests-setup.md)

## Sécurité

Revues de sécurité effectuées après chaque lot de fonctionnalités (voir les sections « Revue sécurité » de chaque doc listée ci-dessus), complétées par une passe sur l'ensemble de l'application.

- Documentation complète (méthodologie, périmètre, résultat) : [`security-review-2026-08.md`](security-review-2026-08.md)

## Identité visuelle ("Balise")

Palette, typographie (Jost + Public Sans) et composants de base (`Button`, `Badge`) appliqués au header, à la navigation et aux cards festival/logement — inspirés du repérage en camping de festival (topographie, balisage).

- Documentation complète (tokens, choix de direction, périmètre non couvert) : [`design-setup.md`](design-setup.md)

## Accessibilité (RGAA)

Passe d'accessibilité sur l'ensemble du projet : navigation clavier, contraste, annonces dynamiques (`role="alert"`/`role="status"`), sémantique des formulaires, textes alternatifs, titres de page distincts.

- Documentation complète (portée, points hors périmètre nécessitant un audit humain) : [`a11y-setup.md`](a11y-setup.md)

## RGPD & mentions légales

Pages `/mentions-legales` et `/politique-de-confidentialite`, liées dans le footer. Contenu de la politique de confidentialité dérivé du fonctionnement réel de l'app (données collectées, base légale, droits RGPD). Les coordonnées de l'éditeur (`src/config/site.ts`) restent des placeholders à compléter avant mise en ligne.

- Accès : [`/mentions-legales`](http://localhost:3000/mentions-legales), [`/politique-de-confidentialite`](http://localhost:3000/politique-de-confidentialite)
- Documentation complète (portée, ce qui reste à compléter) : [`rgpd-setup.md`](rgpd-setup.md)

## Contact

Formulaire de contact public (nom, email, message), sans envoi d'email — le message est stocké en base et consultable par un admin.

- Accès : [`/contact`](http://localhost:3000/contact) — messages reçus : [`/admin/messages`](http://localhost:3000/admin/messages)
- Documentation complète : [`contact-setup.md`](contact-setup.md)

## Variables d'environnement

Le schéma de validation est dans `src/config/env.ts`. Toute variable manquante ou invalide fait planter l'app au démarrage avec un message clair, plutôt qu'un bug silencieux en prod.

Pour ajouter une nouvelle variable :

1. Ajoutez-la dans `.env.example` (sans valeur secrète)
2. Ajoutez-la dans le schéma `server` ou `client` de `src/config/env.ts`
3. Si c'est une variable `client`, préfixez-la par `NEXT_PUBLIC_` et ajoutez-la aussi dans `experimental__runtimeEnv`

## Scripts disponibles

| Commande               | Rôle                               |
| ---------------------- | ---------------------------------- |
| `npm run dev`          | Lance le serveur de développement  |
| `npm run build`        | Build de production                |
| `npm run start`        | Lance le build de production       |
| `npm run lint`         | Vérifie le code avec ESLint        |
| `npm run format`       | Formate le code avec Prettier      |
| `npm run format:check` | Vérifie le formatage sans modifier |

## Mise en production

Stack recommandée : Vercel (app Next.js) + un nouveau projet Supabase dédié (base de données, Auth, Storage) + Brevo (emails transactionnels, en SMTP custom pour Supabase Auth).

- Documentation complète (tests avant déploiement, base de données vierge, configuration Brevo, déploiement, vérifications finales) : [`deploiement-production.md`](deploiement-production.md)

## Environnement de test (staging)

Même stack qu'en production, sur un sous-domaine dédié (ex. `staging.tondomaine.fr`) plutôt qu'un nouveau nom de domaine — utile pour tester/faire une démo avant un vrai lancement.

- Documentation complète (choix du domaine, configuration DNS chez O2switch, différences avec la prod) : [`staging-setup.md`](staging-setup.md)

## Format à la sauvegarde

Configuré via `.vscode/settings.json` (VS Code + extension **Prettier - Code formatter** requise).

## Pièges connus / dépannage

- **Erreurs TypeScript bizarres après un déplacement de fichiers** (`Cannot find module`, types introuvables) → supprimer le cache Next.js et relancer :

```bash
  rm -rf .next
  npm run dev
```

- **`npx tsc --noEmit` est la vérification la plus fiable** pour valider tout le projet TypeScript d'un coup — plus fiable que de se fier aux erreurs affichées sur un seul fichier ouvert dans l'éditeur.
- **Warning d'hydratation React au premier chargement** (`data-*` inconnu sur `<html>`) : souvent causé par une extension de navigateur qui modifie le DOM avant React. Vérifier en navigation privée avant de chercher un bug côté code.
- **L'alias `@/*` doit pointer vers `./src/*`** dans `tsconfig.json` — à vérifier en priorité si un import `@/...` échoue.

## Utiliser ce starter pour un nouveau projet

Voir l'étape suivante : transformation en template GitHub réutilisable.
