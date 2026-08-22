# Mise en place de la base de données — Journal d'implémentation

> Documente l'implémentation technique du schéma décrit dans [`dbshema.md`](dbshema.md) : stack, fichiers créés, procédure Supabase, et les incidents rencontrés (bug + fuite de credentials) pour éviter de les reproduire.

---

## 1. Stack mise en place

- **PostgreSQL** hébergé sur **Supabase**, extension **PostGIS** activée
- **Drizzle ORM** (`drizzle-orm` v0.45) + **`drizzle-kit`** (v0.31) pour les migrations
- Driver **`postgres`** (postgres.js)

## 2. Fichiers créés / modifiés

| Fichier | Rôle |
|---|---|
| `src/db/schema.ts` | Déclaration des 7 tables Drizzle (voir `dbshema.md`) |
| `src/db/client.ts` | Client Drizzle/Postgres, lit `DATABASE_URL` |
| `src/db/index.ts` | Barrel export (`import { db, ... } from "@/db"`) |
| `drizzle.config.ts` | Config `drizzle-kit` (racine du projet) |
| `src/config/env.ts` | Ajout de `DATABASE_URL` au schéma Zod validé au démarrage |
| `.env.example` | Template commité (sans valeur), variables : `NEXT_PUBLIC_APP_URL`, `DATABASE_URL` |
| `.gitignore` | Ajout de `!.env.example` pour qu'il reste commité malgré la règle `.env*` |
| `package.json` | Scripts `db:generate`, `db:migrate`, `db:push`, `db:studio` |

## 3. Procédure Supabase suivie

1. Création du projet sur [supabase.com](https://supabase.com) (région proche des utilisateurs cibles, mot de passe DB généré)
2. Activation de PostGIS : **Database → Extensions → `postgis`**
3. Écran **Security** à la création du projet : seule l'option **"Enable automatic RLS"** a été cochée. **"Enable Data API"** et **"Automatically expose new tables"** ont été laissées décochées car le projet n'utilise pas `supabase-js`/PostgREST — l'accès se fait exclusivement via Drizzle en connexion Postgres directe (`DATABASE_URL`)
4. Récupération de la chaîne de connexion : **Project Settings → Database → Connection string → URI** (connexion directe, port 5432, utilisée telle quelle pour le MVP)

## 4. Incidents rencontrés

### 4.1 Bug `drizzle-kit` : colonne PostGIS `geography` cassée

**Symptôme** : `npm run db:migrate` échouait silencieusement (spinner qui tourne, exit code 1, pas de message d'erreur lisible dans la sortie du CLI).

**Cause** : la colonne géospatiale était déclarée via un `customType` Drizzle avec `dataType() { return "geography(Point, 4326)"; }`. Le générateur SQL de `drizzle-kit` (`src/sqlgenerator.ts`, fonction `parseType`) ne rend un type **sans guillemets** que s'il commence par un nom présent dans une liste blanche de types Postgres natifs (`uuid`, `text`, `geometry`, etc.). `geography` n'y figure pas — uniquement `geometry`. Résultat : le type généré était entouré de guillemets comme s'il s'agissait d'un identifiant :
```sql
"location" "geography(Point, 4326)"  -- invalide : Postgres cherche un TYPE nommé littéralement "geography(Point, 4326)"
```
Erreur Postgres réelle (obtenue en exécutant le SQL généré directement via le driver `postgres`, en contournant le CLI dont le spinner masquait le message) :
```
PostgresError: type "geography(Point, 4326)" does not exist   (code 42704)
```

**Correctif appliqué** : déclarer la colonne en `geometry(Point, 4326)` au lieu de `geography(Point, 4326)` dans `src/db/schema.ts` — reconnu nativement par `drizzle-kit`, donc généré sans guillemets. Impact fonctionnel : pour un calcul de distance réel en mètres (recherche de logements proches d'un festival), caster la colonne en géographie dans les requêtes :
```sql
ST_Distance(location::geography, other_point::geography)
```
plutôt que d'utiliser les fonctions `geometry` brutes (qui raisonnent en degrés sur un plan, imprécises pour du "proche de X km").

**Aucune donnée perdue** : la transaction de migration avait échoué et été annulée avant la moindre écriture, aucune table n'existait en base au moment du correctif.

### 4.2 Fuite potentielle de credentials : fichiers `.env` inversés

**Symptôme** : `DATABASE_URL manquant` alors que la valeur avait bien été renseignée quelque part.

**Cause** : la vraie chaîne de connexion (avec mot de passe) avait été collée dans `.env.example` — le fichier **template, volontairement commité sur git** (voir §2, exception ajoutée dans `.gitignore` pour qu'il soit suivi). `.env.local` — le fichier réellement ignoré par git et lu par `drizzle.config.ts` — était resté vide.

**Risque** : si un `git add`/`commit` avait eu lieu avant correction, le mot de passe de production Supabase aurait été poussé sur le remote (GitHub), potentiellement visible publiquement selon la visibilité du repo, et resté dans l'historique git même après suppression ultérieure.

**Vérification effectuée** : `git status` confirmait `.env.example` en statut `??` (non suivi, jamais commité) au moment du correctif — aucune fuite réelle via git.

**Correctif appliqué** : valeur déplacée vers `.env.local` (ignoré par git), `.env.example` remis à blanc (`DATABASE_URL=`).

**Recommandation restante** : le mot de passe a transité en clair dans la conversation avec l'assistant. Par hygiène, il est recommandé de le régénérer via **Supabase → Project Settings → Database → Reset database password**, puis de mettre à jour `.env.local` en conséquence. *(Statut : à faire — non bloquant pour la suite du développement.)*

### 4.3 Désynchronisation des snapshots `drizzle-kit` après une migration `--custom`

**Symptôme** : `npm run db:generate` a échoué avec `Error: Interactive prompts require a TTY terminal` en essayant d'ajouter de nouvelles colonnes sur `listing_festivals` — alors qu'aucune colonne n'était renommée dans cette modification.

**Cause** : lors d'un renommage de colonne précédent (`price_default` → `price_per_night`), la migration avait été écrite à la main via `drizzle-kit generate --custom` (`ALTER TABLE ... RENAME COLUMN`) plutôt que via la détection de renommage interactive de `drizzle-kit generate`, pour éviter d'y répondre en environnement non-interactif (voir §7). **Mais `--custom` ne recalcule pas le snapshot** (`drizzle/meta/000X_snapshot.json`) à partir de `schema.ts` — il se contente de dupliquer le snapshot précédent (identique à un `git commit --allow-empty`, seul l'id/prevId change). Le nom de colonne `price_default` restait donc figé dans le suivi interne de `drizzle-kit`, alors que la base réelle et `schema.ts` avaient déjà `price_per_night`. À la génération suivante, `drizzle-kit` a comparé son snapshot obsolète (`price_default`) au `schema.ts` actuel (`price_per_night`) et a voulu demander interactivement "renommage ou nouvelle colonne ?" — ce qui plante hors TTY.

**Correctif appliqué** :
1. Édition directe du fichier `drizzle/meta/0005_snapshot.json` (script Python) pour renommer la clé `price_default` → `price_per_night` dans la définition de colonne, reflétant l'état réel de la base.
2. Suppression du fichier de migration `0006` généré entre-temps (vide de tout changement réel) et de son entrée dans `drizzle/meta/_journal.json`.
3. Relance de `npm run db:generate` (sans `--custom`) : diff propre, sans ambiguïté, sans prompt.

**Enseignement** : après toute migration `--custom` qui renomme ou restructure une colonne à la main (`RENAME COLUMN`, etc.), le snapshot `drizzle/meta/000X_snapshot.json` doit être corrigé manuellement pour refléter le nouvel état — sinon la prochaine `drizzle-kit generate` se retrouve avec un état interne incohérent avec la réalité, et échoue dès qu'une confirmation interactive serait normalement requise. À vérifier systématiquement : `grep <ancien_nom> drizzle/meta/000X_snapshot.json` après toute migration custom touchant un renommage.

## 5. État actuel

Migration `drizzle/0000_purple_wilson_fisk.sql` générée et appliquée avec succès. Tables confirmées présentes sur Supabase (`information_schema.tables`) :

```
bookings, festivals, listing_festivals, listing_photos, listings, reviews, users
```

## 6. Enseignements pour la suite

- Toujours vérifier la sortie réelle de `drizzle-kit migrate` en cas d'échec silencieux : rejouer le fichier SQL généré directement via le driver `postgres` (`sql.unsafe(...)`) donne le message d'erreur Postgres complet, plus fiable que le spinner du CLI.
- Pour tout type Postgres non standard utilisé via `customType`, vérifier son rendu dans le SQL généré (`drizzle/000X_*.sql`) avant d'appliquer la migration — ne pas supposer que le nom du type est reproduit tel quel.
- Ne jamais coller de valeur réelle dans `.env.example` : c'est le seul fichier `.env*` volontairement suivi par git dans ce projet.

## 7. Workflow pour les prochaines évolutions du schéma

Le cycle `db:generate` + `db:migrate` a déjà été exécuté pour la migration initiale (§5) — **pas besoin de le relancer tant que `src/db/schema.ts` n'a pas changé**.

À refaire uniquement après toute modification de `src/db/schema.ts` (nouvelle table, nouveau champ, changement de contrainte...) :
```bash
npm run db:generate   # génère un nouveau fichier de migration incrémental à partir du diff du schéma
npm run db:migrate    # applique les migrations en attente sur la base Supabase
```

## 8. Action en attente

- [ ] **Rotation du mot de passe Supabase** (voir §4.2) — le mot de passe a transité en clair dans une conversation, à régénérer par précaution via **Project Settings → Database → Reset database password**, puis mettre à jour `.env.local`. Non bloquant, mais à faire avant tout déploiement en production.
