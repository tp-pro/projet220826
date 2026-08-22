# Authentification & données de test — Journal d'implémentation

> Documente la mise en place de l'auth (Supabase Auth) et du jeu de données fictives, en complément de [`dbshema.md`](dbshema.md) (modèle de données) et [`db-setup.md`](db-setup.md) (mise en place de la base).

---

## 1. Stack et décisions

- **Supabase Auth**, email + mot de passe, **confirmation email active** (pas désactivée, contrairement à ce qui simplifierait les tests — choix assumé pour rester fidèle au comportement final)
- Un seul type de compte (pas de rôle `host`/`guest` séparé) — cohérent avec la décision prise dans `dbshema.md` §4.6
- `@supabase/ssr` pour la gestion de session compatible Server Components / Server Actions / middleware Next.js (App Router)

## 2. Fichiers créés

| Fichier                                                      | Rôle                                                                                                             |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `src/lib/supabase/client.ts`                                 | Client Supabase pour les Client Components (clé publique)                                                        |
| `src/lib/supabase/server.ts`                                 | Client Supabase pour Server Components/Actions (lit/écrit les cookies de session)                                |
| `src/lib/supabase/middleware.ts`                             | Logique de rafraîchissement de session                                                                           |
| `src/middleware.ts`                                          | Middleware Next.js racine, appelle `updateSession` sur chaque requête (hors assets statiques)                    |
| `src/lib/supabase/admin.ts`                                  | Client "admin" (clé `service_role`, bypass RLS) — **réservé aux scripts serveur**, jamais importable côté client |
| `src/lib/auth/actions.ts`                                    | Server Actions `signUpAction`, `signInAction`, `signOutAction`                                                   |
| `src/components/auth/SignUpForm.tsx`, `SignInForm.tsx`       | Formulaires (Client Components, `useActionState`)                                                                |
| `src/app/inscription/page.tsx`, `src/app/connexion/page.tsx` | Pages publiques                                                                                                  |
| `src/app/compte/page.tsx`                                    | Page protégée — redirige vers `/connexion` si non connecté                                                       |
| `src/components/layout/Header.tsx`                           | Devenu async Server Component, affiche "Connexion/Inscription" ou "Mon compte" + `RoleSwitcher` selon la session |
| `src/components/layout/RoleSwitcher.tsx`                     | Toggle Festivalier/Hôte dans le Header (voir §10)                                                                |
| `src/app/logements/nouveau/page.tsx`                         | Page de création de logement, protégée (voir §10 et `listings-setup.md`)                                         |
| `drizzle/0001_sync_auth_users.sql`                           | Trigger Postgres (voir §3)                                                                                       |
| `scripts/seed.ts`                                            | Script de données fictives (voir §5)                                                                             |

## 3. Synchronisation `auth.users` ↔ `public.users`

Supabase Auth gère ses comptes dans un schéma interne `auth` (table `auth.users`), séparé de notre table métier `public.users` définie dans `dbshema.md`. Un trigger Postgres (migration `0001_sync_auth_users.sql`) copie automatiquement `id`, `email` et `full_name` (depuis les métadonnées utilisateur) vers `public.users` dès qu'un compte Supabase Auth est créé — inscription classique, admin API, ou futur OAuth.

Point technique important : la fonction du trigger est déclarée `security definer`, car `public.users` a le RLS activé par défaut (choix fait à la création du projet Supabase, voir `db-setup.md` §3) sans aucune policy définie — sans ce `security definer`, l'insertion échouerait silencieusement.

Cette migration a déjà été appliquée sur la base (`npm run db:migrate`).

## 4. Variables d'environnement ajoutées

```
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<publishable key>
SUPABASE_SERVICE_ROLE_KEY=<secret key>          # ⚠️ serveur uniquement
```

Validées au démarrage via `src/config/env.ts` (même mécanisme que `DATABASE_URL`, voir `db-setup.md`).

### Où les trouver (retours d'expérience de cette session)

- Supabase a **récemment renommé** les clés API historiques : ce qui s'appelait `anon` s'appelle maintenant **"publishable key"**, et `service_role` s'appelle **"secret key"**. Même rôle, nouveau nom — normal de ne pas retrouver les anciens termes dans le dashboard.
- Ces clés se trouvent sous un onglet dédié **"API Keys"** dans les Project Settings — **pas** sous l'onglet "General" (qui n'affiche que Project Name/ID/Region), piège rencontré pendant cette session.
- Le **Project URL** n'a pas besoin d'être cherché séparément : il se construit directement à partir du **Project ID** (visible dans "General") via le gabarit `https://<project-id>.supabase.co`.
- ⚠️ Piège rencontré : le domaine Supabase se termine en **`.co`**, pas `.com`. Une première tentative avec `.supabase.com` a fait échouer la validation d'env silencieusement côté navigateur (URL valide syntaxiquement pour Zod, mais qui ne pointe vers rien) — repéré par comparaison avec le `DATABASE_URL` déjà correct.

## 5. Script de seed (`scripts/seed.ts`)

Génère un jeu de données fictives minimal et réaliste, **idempotent** (relançable sans dupliquer — nettoie d'abord les données du seed précédent par email/slug avant de tout recréer).

Commande : `npm run db:seed` (utilise `tsx --env-file=.env.local` pour charger les variables d'environnement au niveau du process Node, avant tout import — évite le problème classique d'ordre d'évaluation des imports ESM avec `dotenv`).

### Pourquoi la clé `service_role` est nécessaire ici

La confirmation email étant active (§1), un compte créé "normalement" resterait injoignable pour se connecter en test (pas de vraie boîte mail derrière `host1@festcamp.test`). Le script utilise donc l'API admin de Supabase (`supabase.auth.admin.createUser`, via `src/lib/supabase/admin.ts`) pour créer des comptes **déjà confirmés**, avec un mot de passe connu. Le parcours réel d'inscription (`/inscription`) continue lui d'exiger la confirmation par email pour tout nouveau compte.

### Contenu généré

- **4 festivals** : Dour Festival (BE), Hellfest (FR), Fusion Festival (DE), Vieilles Charrues (FR, volontairement en statut `draft` pour tester un festival non publié)
- **8 logements** couvrant les 5 types (`entire_place`, `private_room`, `camping_spot`, `glamping`, `couch`) et plusieurs statuts de modération (`published`, `pending_review`, `rejected` avec motif) pour pouvoir tester le workflow complet décrit dans `dbshema.md` §4.3
- **6 comptes utilisateurs**, mot de passe unique **`test1234`** :

| Email                  | Nom            | Rôle illustré                                     |
| ---------------------- | -------------- | ------------------------------------------------- |
| `admin@festcamp.test`  | Admin Festcamp | créateur des festivals / modérateur des logements |
| `host1@festcamp.test`  | Julie Martin   | hôte                                              |
| `host2@festcamp.test`  | Marc Dubois    | hôte                                              |
| `guest1@festcamp.test` | Sophie Bernard | festivalier                                       |
| `guest2@festcamp.test` | Karim Haddad   | festivalier                                       |
| `both1@festcamp.test`  | Léa Rousseau   | double rôle hôte + festivalier                    |

- **3 réservations** (statuts `accepted`, `pending`, `rejected`) et **2 avis** bidirectionnels sur la réservation acceptée

## 6. Comment tester

```bash
npm run dev
```

- [`/inscription`](http://localhost:3000/inscription) — créer un vrai compte (confirmation email requise)
- [`/connexion`](http://localhost:3000/connexion) — se connecter avec un compte du seed (§5) → redirige vers `/compte`
- [`/compte`](http://localhost:3000/compte) — page protégée, affiche email/nom de session + déconnexion

## 7. Bugs rencontrés et corrigés lors des premiers tests

### 7.1 `A "use server" file can only export async functions, found object`

`src/lib/auth/actions.ts` (`"use server"`) exportait initialement `initialAuthActionState`, une **constante objet** utilisée par les formulaires comme état initial de `useActionState`. Next.js interdit tout export non-fonction-async dans un fichier `"use server"` (chaque export y est traité comme une référence de Server Action pour le bundle client).

**Correctif** : extraction du type `AuthActionState` et de la constante `initialAuthActionState` dans un fichier séparé, `src/lib/auth/types.ts` (sans `"use server"`). `actions.ts` n'exporte plus que les 3 fonctions async (`signUpAction`, `signInAction`, `signOutAction`), les Client Components (`SignUpForm`, `SignInForm`) important chacun depuis le fichier adéquat.

**Enseignement** : dans un fichier `"use server"`, ne jamais y faire cohabiter des exports de données (types, constantes, helpers) avec les Server Actions elles-mêmes — les isoler systématiquement dans un fichier `types.ts`/`utils.ts` voisin dès la conception.

### 7.2 `Failed to find Server Action "..."` après modification de `actions.ts`

Artefact du Hot Reload en dev : après une modification d'un fichier exportant des Server Actions, leurs identifiants internes sont régénérés, mais un onglet déjà ouvert sur une page utilisant l'ancien formulaire garde une référence à l'ancien identifiant, devenu invalide.

**Correctif** : rechargement complet du navigateur (pas juste attendre le HMR). Si ça persiste, redémarrer `npm run dev`. Pas un bug de code — normal après une édition de fichier `"use server"` en cours de session dev.

## 8. Point de vigilance non résolu

Le lien de confirmation envoyé par Supabase à l'inscription (`emailRedirectTo` dans `signUpAction`, pointant vers `/connexion`) doit correspondre à une URL autorisée côté Supabase (**Authentication → URL Configuration → Redirect URLs**). Un projet fraîchement créé autorise `http://localhost:3000` par défaut comme Site URL, ce qui devrait suffire — mais si le lien de confirmation échoue ou redirige mal, c'est le premier endroit à vérifier.

## 9. Validé lors des tests

- ✅ Connexion avec un compte du seed (`host1@festcamp.test`) → redirection vers `/compte`, informations de session affichées correctement, bouton déconnexion présent.
- ✅ Switch Festivalier/Hôte dans le Header (voir §10).

## 10. Switch Festivalier ↔ Hôte

Comme sur Airbnb : une fois connecté, un toggle dans le `Header` (`RoleSwitcher.tsx`) permet de basculer entre les deux usages de la plateforme, cohérents avec le compte unique à double rôle (`dbshema.md` §4.6) :

- **Festivalier** → `/` (liste des festivals, déjà existante)
- **Hôte** → `/logements/nouveau` (page de création de logement)

### Choix d'implémentation

Pas de notion de "mode" persistée (ni en base, ni en cookie/session) : le switch est une **navigation entre deux routes fixes**, pas un état global qui changerait l'affichage du reste du site. `RoleSwitcher` est un Client Component qui lit `usePathname()` pour surligner l'onglet actif — le `Header` reste un Server Component pour la vérification de session (inchangée), seul le toggle est extrait en Client Component (`usePathname` n'existe que côté client).

Visible uniquement connecté, cohérent avec la demande initiale ("une fois connecté je dois pouvoir switcher").

### `/logements/nouveau`

Initialement un placeholder volontaire (texte + liste des champs prévus, sans formulaire fonctionnel). **Depuis remplacé par le vrai formulaire** — voir [`listings-setup.md`](listings-setup.md) pour l'implémentation complète (Server Action, upload de photos vers Supabase Storage, règles métier).

## 11. Réinitialisation de mot de passe ("mot de passe oublié")

Demande explicite : "en tant qu'utilisateur je dois pouvoir effectuer un renouvellement de mot de passe".

### Fichiers créés

| Fichier                                                                                    | Rôle                                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/lib/auth/actions.ts`                                                                  | `requestPasswordResetAction` (ajoutée) — appelle `supabase.auth.resetPasswordForEmail`, répond **toujours** le même message générique que l'email corresponde ou non à un compte (pas d'énumération de comptes)                                                                                                          |
| `src/components/auth/RequestPasswordResetForm.tsx`, `src/app/mot-de-passe-oublie/page.tsx` | Formulaire de demande (email → lien envoyé)                                                                                                                                                                                                                                                                              |
| `src/components/auth/NewPasswordForm.tsx`, `src/app/mot-de-passe-oublie/nouveau/page.tsx`  | Choix du nouveau mot de passe — Client Component qui détecte soit le jeton de récupération (`PASSWORD_RECOVERY` via `onAuthStateChange`), soit une session déjà active : sert donc **aussi** de "changer mon mot de passe" pour un utilisateur déjà connecté (lien ajouté sur `/compte`), sans code dédié supplémentaire |
| `src/components/auth/ConfirmEmailAction.tsx`, `src/app/auth/confirm/page.tsx`              | Voir §13 — page de confirmation intermédiaire, nécessaire pour que le lien fonctionne de façon fiable                                                                                                                                                                                                                    |

Lien "Mot de passe oublié ?" ajouté sur `/connexion`.

### Piège rencontré — lien "déjà expiré" immédiatement

Premier retour utilisateur après un vrai test avec Gmail : le lien reçu par email était systématiquement invalide dès le premier clic, sans lien avec un vrai délai d'expiration. Deux causes possibles, toutes deux réelles pour ce genre de flow Supabase :

1. **Pré-scan automatique des liens par le client mail** (Gmail Safe Browsing, Outlook Safe Links...) : ces clients visitent automatiquement chaque lien d'un email reçu pour le scanner (anti-phishing) **avant** que l'utilisateur ne clique. Le lien de réinitialisation par défaut de Supabase pointe directement vers l'endpoint hébergé `{SUPABASE_URL}/auth/v1/verify`, qui consomme le jeton à usage unique dès un simple `GET` — le scan automatique le grille avant le vrai clic.
2. **Flow PKCE et navigateur d'origine** : par défaut, le lien encode un `code` qui nécessite un `code_verifier` stocké dans le `localStorage` du navigateur **ayant initié** la demande — un clic depuis l'app Gmail ou un autre navigateur/appareil n'a jamais ce `code_verifier`, et échoue pour une raison différente mais avec le même symptôme.

### Corrigé — confirmation par clic explicite (`token_hash`, pas `code`/`ConfirmationURL`)

Voir §13 (`ConfirmEmailAction.tsx`) : le lien pointe vers une page propre à l'app, l'échange du jeton (`verifyOtp({ token_hash, type })`) n'est déclenché **que** par un clic humain sur un bouton — jamais automatiquement au chargement. `verifyOtp` par `token_hash` est en plus indépendant du navigateur d'origine, réglant les deux causes à la fois. C'est le pattern officiellement recommandé par Supabase pour ce cas précis.

### ⚠️ Changement à faire manuellement dans le Dashboard Supabase (non fait par ce chantier)

**Authentication → Email Templates → "Reset Password"**, remplacer le lien `{{ .ConfirmationURL }}` par :

```
{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/mot-de-passe-oublie/nouveau
```

Nécessaire **sur chaque projet Supabase** utilisant ce flow (le projet de dev, puis séparément le projet de prod dédié — voir `deploiement-production.md` §4.7). Pas besoin de toucher aux "Redirect URLs" pour ce template : le lien pointe directement vers le site, jamais vers l'endpoint Supabase concerné par le piège ci-dessus.

### Comment tester

1. `/mot-de-passe-oublie`, saisir un email → message générique affiché quel que soit l'email
2. Une fois le template Dashboard modifié (voir ci-dessus) : lien reçu par email, ouvert **sur la même machine** que celle faisant tourner `npm run dev` → page `/auth/confirm` avec un bouton "Confirmer" (pas d'action automatique au chargement) → clic → nouveau mot de passe

### Validé lors des tests

- ✅ `/mot-de-passe-oublie` avec un email inexistant → même message que pour un email existant
- ✅ `/mot-de-passe-oublie/nouveau` sans session/jeton valide → "lien invalide ou expiré" avec lien pour en redemander un
- ✅ `npx tsc --noEmit` et `npx eslint .` propres
- ⚠️ Non testé de bout en bout avec un vrai jeton valide (nécessite le changement de template Dashboard ci-dessus, pas encore appliqué au moment de la rédaction)

## 12. Suppression de compte utilisateur

Demande explicite : "en tant qu'utilisateur je dois pouvoir supprimer mon compte depuis mon compte [...]. Si j'ai un logement ou si j'ai une réservation en attente ou en cours je ne peux pas supprimer mon compte et le bouton est non cliquable."

### Règle métier

Un compte ne peut pas être supprimé si :

- l'utilisateur possède un logement (`listings.host_id`), quel que soit son statut de modération — il doit d'abord le supprimer (§18 de `listings-setup.md`) ;
- l'utilisateur a une réservation `pending` ou `accepted` en tant que festivalier (`bookings.guest_id`).

### Fichiers créés/modifiés

- [`src/lib/profile/actions.ts`](src/lib/profile/actions.ts) — `accountDeletionBlockReason(userId)` (raison de blocage ou `null`, revérifiée côté serveur avant d'agir) et `deleteAccountAction` : supprime la ligne `public.users` (cascade vers réservations résolues/avis via les FK existantes, `dbshema.md`), puis le compte Supabase Auth lui-même via le client admin (`auth.admin.deleteUser`) — **deux suppressions explicites**, `auth.users` et `public.users` n'étant liés que par synchronisation à la création (`0001_sync_auth_users.sql`, §3), pas par une contrainte de clé étrangère.
- [`src/components/profile/DeleteAccountButton.tsx`](src/components/profile/DeleteAccountButton.tsx) — réutilise `ConfirmDialog` (introduit en §18 de `listings-setup.md`) ; grisé + message quand `blockReason` est renseigné.
- [`src/app/compte/page.tsx`](src/app/compte/page.tsx) — section "Zone de danger", calcule `accountBlockReason` côté serveur.

### Point de vigilance non résolu — ordre des deux suppressions

`deleteAccountAction` supprime d'abord `public.users`, puis le compte Auth. Si le second appel échoue (API admin indisponible...), la session Auth reste valide sans ligne applicative correspondante — état dégradé auto-infligé (seulement l'utilisateur concerné, pas de tiers, pas d'accès non autorisé, `requireAdmin` et consorts échouent de toute façon "fermé" sans ligne `users`). Identifié et classé faux positif lors de la revue de sécurité §13 — pas corrigé pour l'instant (pas de déconnexion automatique sur ce chemin d'erreur), à améliorer si ça se présente en pratique.

### Comment tester

1. Connecté sans logement ni réservation active, `/compte` → bouton "Supprimer mon compte" actif → confirmation → compte supprimé, redirection accueil, déconnecté
2. Avec un logement ou une réservation `pending`/`accepted` → bouton grisé, message explicatif affiché

### Validé lors des tests

- ✅ Bouton actif → boîte de dialogue centrée de confirmation
- ✅ Bouton bloqué (logement existant) → grisé, message "Tu as un logement, tu ne peux pas supprimer ton compte. Supprime-le d'abord."
- ✅ `npx tsc --noEmit` et `npx eslint .` propres

## 13. Revue de sécurité — flow de confirmation par email

Passe de sécurité ciblée (regard offensive security) sur les 3 chantiers récents — suppression de logement (§18 de `listings-setup.md`), §11 et §12 ci-dessus — méthodologie : identification des vulnérabilités puis contre-vérification indépendante de chaque piste pour écarter les faux positifs.

### 🔴 Confirmé et corrigé — open redirect dans `ConfirmEmailAction.tsx`

Le paramètre `next` de `/auth/confirm` (URL de redirection après confirmation) était filtré par **liste noire de caractères** (`safeNextPath`, rejette `//...`, `\...`). Un caractère de contrôle encodé (`%09`, tabulation) glissé dans `next` passait ce filtre tel quel, puis se faisait normaliser en `//evil.com` par le parseur d'URL interne utilisé par `router.push()` de Next.js — navigation externe réelle après un clic pourtant légitime sur "Confirmer".

**Exploit concret** : un attaquant obtient son propre `token_hash` valide (auto-inscription ou sa propre demande de réinitialisation), l'envoie à une victime avec `next=%2F%09%2Fevil.com` — la victime clique "Confirmer" (action de confiance) et se retrouve redirigée vers `evil.com`, juste après une action authentifiée réussie (vecteur de phishing crédible).

**Correctif** : liste noire de caractères remplacée par une résolution via le même parseur WHATWG (`new URL(next, window.location.origin)`) que celui utilisé en interne par Next.js, en ne gardant le résultat que si son origine reste celle du site — comportement réel plutôt que motif de caractères, imperméable par construction à ce type de contournement.

### Faux positif écarté — ordre des suppressions dans `deleteAccountAction`

Voir §12 ci-dessus, "Point de vigilance non résolu" — bug de robustesse auto-infligé (uniquement l'utilisateur concerné, aucun accès non autorisé pour un tiers), pas une vulnérabilité de sécurité au sens strict.

### Validé lors des tests

- ✅ PoC de l'attaque (`next` avec tabulation encodée) rejeté après correctif, chemins internes légitimes toujours acceptés, URLs absolues/protocol-relative toujours bloquées (vérifié avec le parseur WHATWG réel de Node, en isolation et via la logique du routeur Next.js)
- ✅ `npx tsc --noEmit`, `npx eslint .` et `npx prettier --check` propres
