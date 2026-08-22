# Mise en production — Procédure

> Procédure de mise en production de Festcamp : tests avant déploiement, base de données de production vierge, emails transactionnels (Brevo), hébergement recommandé, et vérifications finales. Complète [`db-setup.md`](db-setup.md) (incidents déjà rencontrés côté base de données — à ne pas reproduire), [`auth-setup.md`](auth-setup.md) (comportement réel de l'authentification), [`rgpd-setup.md`](rgpd-setup.md) (mentions légales à compléter) et [`dbshema.md`](dbshema.md) (modèle de données).

---

## 1. Vue d'ensemble — stack de production recommandée

| Composant                        | Recommandation                                  | Pourquoi                                                                                                                                                                        |
| -------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hébergement de l'app Next.js     | **Vercel**                                      | Éditeur de Next.js — support natif du App Router/Server Actions, zéro configuration, déploiements automatiques par push, preview par PR, variables d'env en interface. Voir §6. |
| Base de données + Auth + Storage | **Supabase Cloud**, nouveau projet dédié        | Déjà utilisé en développement (mêmes clients `@supabase/ssr`, Drizzle) — aucune réécriture de code nécessaire, juste un nouveau projet **vierge**. Voir §4.                     |
| Emails transactionnels           | **Brevo**, en SMTP custom pour Supabase Auth    | Le service email intégré de Supabase est limité et non prévu pour de vrais utilisateurs (voir §5.1). Brevo est un fournisseur SMTP explicitement supporté par Supabase.         |
| Nom de domaine + DNS             | Registrar au choix + DNS géré par lui ou Vercel | Nécessaire pour les redirections Auth (§4.7) et l'authentification du domaine d'envoi Brevo (SPF/DKIM, §5.2).                                                                   |

Aucun changement d'architecture requis par rapport au développement : même code, mêmes variables d'environnement (`src/config/env.ts`), juste de nouvelles valeurs pointant vers des ressources de production dédiées.

## 2. Pré-requis — comptes à créer

- [ ] Compte [Vercel](https://vercel.com) (relié au dépôt Git du projet)
- [ ] Compte [Supabase](https://supabase.com) (peut être le même compte qu'en dev, mais **nouveau projet**, voir §4.1)
- [ ] Compte [Brevo](https://www.brevo.com)
- [ ] Nom de domaine acheté et accès à sa gestion DNS

---

## 3. Tests et vérifications avant déploiement

Ce projet n'a pas de suite de tests automatisés (`npm test` n'existe pas) — la validation repose sur les vérifications statiques ci-dessous et une QA manuelle des parcours critiques, comme cela a été fait tout au long du développement.

### 3.1 Vérifications automatisées (sur la branche à déployer)

```bash
npm run format:check   # Prettier
npx tsc --noEmit       # TypeScript
npx eslint .            # ESLint
npm run build           # build de production réel — attrape des erreurs que `next dev` ne montre pas
```

Les quatre doivent passer sans erreur avant de continuer. `npm run build` en particulier : c'est le seul moyen de vérifier que le build de production compile réellement (le mode dev est plus tolérant sur certaines erreurs).

### 3.2 Revue de sécurité

Une revue de sécurité a déjà été effectuée à plusieurs reprises pendant le développement (voir les sections "Revue sécurité" dans `listings-setup.md` §13, `contact-setup.md` §5, `festival-detail-setup.md` §7, `auth-setup.md` §13) — aucune vulnérabilité HIGH/MEDIUM non corrigée à ce jour. Avant la mise en production, relancer une dernière passe globale sur l'ensemble du diff depuis la dernière revue (`/code-review ultra` ou équivalent) pour couvrir les changements les plus récents.

Points déjà connus et **volontairement acceptés pour le MVP**, à garder en tête (pas des vulnérabilités, mais des choix produit à ne pas oublier en cas d'incident) : pas de rate limiting sur le formulaire de contact (`contact-setup.md` §1), pas de nettoyage des fichiers Storage orphelins pour les photos supprimées (`listings-setup.md` §8).

### 3.3 Checklist de QA manuelle — parcours critiques

À exécuter en local ou sur un environnement de préproduction avant le déploiement final, puis **à refaire une seconde fois en production** (§7) une fois le déploiement effectif.

**Visiteur non connecté**

- [ ] Page d'accueil, liste des festivals
- [ ] Pages RGPD (`/mentions-legales`, `/politique-de-confidentialite`) et page `/contact` — envoi d'un message de test
- [ ] Inscription (`/inscription`) avec une **vraie adresse email** → email de confirmation reçu (valide le SMTP Brevo, §5) → lien de confirmation fonctionnel → connexion possible ensuite
- [ ] Accès à une page protégée sans être connecté → redirection vers `/connexion`
- [ ] `/mot-de-passe-oublie` avec une **vraie adresse email** → lien reçu → clic → page `/auth/confirm` (bouton "Confirmer", pas d'action automatique) → nouveau mot de passe choisi → connexion possible ensuite avec ce nouveau mot de passe (nécessite le template Email modifié en §4.7, `auth-setup.md` §11)

**Festivalier**

- [ ] Page détail festival (`/festivals/[slug]`) : filtres (type, nombre de personnes 1–10, prix maximum, navette) — seuls ou combinés, bouton "Réinitialiser"
- [ ] Fiche logement, envoi d'une demande de mise en relation
- [ ] `/mes-demandes` : statut de la demande, motif si refusée

**Hôte**

- [ ] Création d'un logement (`/logements/nouveau`) avec photos + justificatif de domicile optionnel
- [ ] Modification du logement (`/logements/[id]/modifier`) — vérifier qu'elle repasse bien en `pending_review` et redevient temporairement invisible publiquement si elle était déjà publiée
- [ ] `/logements/demandes` : accepter/refuser une demande reçue
- [ ] Bannière de validation sur `/compte` une fois le logement approuvé par un admin
- [ ] Suppression du logement (`/logements/[id]/modifier`, "Zone de danger") : bouton grisé avec réservation acceptée en cours, actif et fonctionnel sinon (`listings-setup.md` §18)

**Compte (tous rôles)**

- [ ] Suppression de compte (`/compte`, "Zone de danger") : bouton grisé avec un logement ou une réservation `pending`/`accepted`, actif et fonctionnel sinon (`auth-setup.md` §12)

**Admin** (compte créé et promu selon §4.9)

- [ ] `/admin/logements` : contenu enrichi visible (photos, description, festival associé...), accepter/refuser
- [ ] Lien "consulter" vers un justificatif de domicile fourni → s'ouvre sans erreur (`InvalidJWT` corrigé, `listings-setup.md` §11)
- [ ] `/admin/hotes` : suspendre/réactiver un hôte
- [ ] `/admin/festivals` : créer/modifier un festival, upload de l'image de couverture
- [ ] `/admin/messages` : messages de contact reçus visibles

**Transverse**

- [ ] Fil d'ariane présent sur toutes les pages sauf l'accueil, absent sur l'accueil
- [ ] Responsive : filtres empilés en mobile, alignés sur une ligne en desktop (`festival-detail-setup.md` §9)

### 3.4 Vérifications de code avant prod

- [ ] `git status` propre sur la branche à déployer, rien d'oublié en local
- [ ] Aucune valeur réelle (mot de passe, clé) ne traîne dans un fichier commité — en particulier `.env.example` doit rester vide de toute valeur (incident déjà survenu une fois, voir `db-setup.md` §4.2)
- [ ] `scripts/seed.ts` ne doit **jamais** être exécuté contre la base de production — il crée des comptes de test à mot de passe connu (`test1234`, voir `auth-setup.md`). Ne pas ajouter `db:seed` à un pipeline de déploiement automatique.

---

## 4. Nouvelle base de données — projet Supabase vierge dédié

**Ne jamais réutiliser le projet Supabase de développement pour la production.** Un nouveau projet, séparé, vierge de toute donnée de test.

### 4.1 Création du projet

Sur [supabase.com](https://supabase.com), créer un nouveau projet — région proche des utilisateurs cibles, mot de passe de base de données **généré aléatoirement et unique** (ne jamais réutiliser un mot de passe qui a transité en clair ailleurs — voir l'incident et sa recommandation dans `db-setup.md` §4.2/§8, qui s'applique aussi à ce nouveau projet par précaution générale).

À l'écran **Security** de création : garder **"Enable automatic RLS"** coché ; laisser **"Enable Data API"** et **"Automatically expose new tables"** décochés — ce projet n'utilise jamais PostgREST/`supabase-js` pour la donnée métier, uniquement Drizzle en connexion directe (`db-setup.md` §3).

### 4.2 Extension PostGIS

**Database → Extensions → activer `postgis`**, **avant** d'appliquer la moindre migration — la table `festivals`/`listings` utilise une colonne `geometry(Point, 4326)` dès la première migration (`dbshema.md` §1, `db-setup.md` §4.1).

### 4.3 Récupération des clés

**Project Settings → API** : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (⚠️ secrète).

**Project Settings → Database → Connection string** : utiliser la version **Transaction pooler** (port **6543**), pas la connexion directe (port 5432) utilisée en dev — indispensable en production sur un hébergement serverless (Vercel) où chaque exécution peut ouvrir sa propre connexion ; le pooler évite d'épuiser les connexions disponibles côté Postgres. Voir `.env.example` pour le format exact.

### 4.4 Variables d'environnement

Renseigner, côté Vercel (§6) et pas dans un fichier commité, toutes les variables de `.env.example` :

```
NEXT_PUBLIC_APP_URL=https://<domaine-de-prod>
DATABASE_URL=<connection string pooler, §4.3>
NEXT_PUBLIC_SUPABASE_URL=<§4.3>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<§4.3>
SUPABASE_SERVICE_ROLE_KEY=<§4.3>
```

### 4.5 Migrations

Avec `DATABASE_URL` pointant vers la base de production (temporairement en local, ou via l'environnement Vercel) :

```bash
npm run db:migrate
```

Les 10 migrations existantes (`drizzle/0000_*.sql` à `drizzle/0009_*.sql`) s'appliquent d'un coup sur une base vierge, dans l'ordre. Vérifier ensuite dans **Table Editor** que les 8 tables attendues existent (`users`, `festivals`, `listings`, `listing_photos`, `listing_festivals`, `bookings`, `reviews`, `contact_messages`).

### 4.6 Buckets Storage

```bash
npm run storage:setup
```

Idempotent — crée `listing-photos` (public), `festival-covers` (public), `listing-certification-docs` (**privé**, voir `listings-setup.md` §9). Vérifier dans **Storage** que les 3 buckets existent avec la bonne visibilité.

### 4.7 Configuration Auth — URLs

**Authentication → URL Configuration** : `Site URL` et `Redirect URLs` doivent pointer vers le domaine de production (`https://<domaine-de-prod>`), pas `localhost`. Sans ça, le lien de confirmation d'inscription (`emailRedirectTo` dans `signUpAction`) redirige vers une URL de dev inaccessible (`auth-setup.md` §8).

**Authentication → Email Templates → "Reset Password"** : le template par défaut ne fonctionne pas de façon fiable (piège documenté en `auth-setup.md` §11 — pré-scan des liens par les clients mail, incompatibilité PKCE cross-navigateur). Remplacer le lien `{{ .ConfirmationURL }}` par :

```
{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/mot-de-passe-oublie/nouveau
```

**À refaire ici manuellement** : ce changement, fait sur le projet Supabase de dev, n'est jamais reporté automatiquement sur le nouveau projet de prod créé en §4.1 — chaque projet Supabase a ses propres templates.

### 4.8 Premier compte admin

Aucune interface ne permet de créer un admin — c'est intentionnel (`admin-setup.md` §1 : pas de liste blanche en variable d'env, tout passe par `users.role`).

1. S'inscrire normalement via `/inscription` sur le domaine de production, avec l'email du futur administrateur.
2. Confirmer l'email (via le lien reçu — teste au passage que Brevo fonctionne, §5).
3. Dans **Supabase → SQL Editor**, sur le projet de production :
   ```sql
   update public.users set role = 'admin' where email = 'admin@example.com';
   ```

### 4.9 Ne jamais lancer le seed

`npm run db:seed` est réservé au développement (`auth-setup.md` §5) — il crée des comptes de démonstration avec un mot de passe connu (`test1234`) directement confirmés via l'API admin. Ne jamais l'exécuter contre la base de production.

---

## 5. Emails transactionnels — Brevo

### 5.1 Pourquoi c'est nécessaire

Le service d'envoi d'email intégré par défaut à Supabase Auth est fortement limité en volume et pensé pour du test, pas pour de vrais utilisateurs — au-delà de quelques emails, les inscriptions/confirmations cessent de partir. Supabase recommande explicitement de configurer un fournisseur SMTP tiers avant la mise en production ; Brevo est l'un des fournisseurs couramment utilisés à cet effet.

### 5.2 Compte Brevo + domaine d'expéditeur

1. Créer un compte sur [brevo.com](https://www.brevo.com).
2. **Senders, Domains & Dedicated IPs → Domains** : ajouter le domaine de production, puis ajouter les enregistrements DNS fournis (SPF, DKIM, et idéalement DMARC) chez le registrar du domaine — nécessaire pour que les emails ne finissent pas en spam.
3. Attendre la validation du domaine (peut prendre jusqu'à quelques heures selon le DNS).

### 5.3 Configuration côté Supabase (SMTP custom)

**Authentication → Emails → SMTP Settings** :

- Activer "Enable Custom SMTP"
- Host : `smtp-relay.brevo.com`
- Port : `587`
- Username : l'identifiant SMTP du compte Brevo (**SMTP & API → SMTP**)
- Password : la clé SMTP Brevo (pas le mot de passe du compte)
- Sender email / Sender name : une adresse du domaine vérifié en §5.2 (ex. `no-reply@<domaine>`)

### 5.4 Test

Reprendre le test d'inscription du §4.8 (ou en refaire un séparé) : l'email de confirmation doit arriver, et apparaître dans **Brevo → Transactional → Email Activity** avec un statut "Delivered".

### 5.5 Piste v2 — notifications par email hors Auth

Le formulaire de contact (`/contact`) stocke aujourd'hui les messages en base sans notifier personne par email — un admin doit consulter `/admin/messages` pour les voir (`contact-setup.md` §1, choix assumé). Une fois Brevo en place pour l'Auth, la même clé API Brevo (API transactionnelle, distincte du SMTP) pourrait être utilisée pour envoyer un email à l'admin à chaque nouveau message — non fait dans cette passe, à la demande si besoin.

---

## 6. Hébergement — déploiement sur Vercel

### 6.1 Pourquoi Vercel

Éditeur de Next.js, support natif et sans configuration du App Router / Server Actions / Server Components utilisés dans tout le projet. Alternative auto-hébergée possible (VPS + `next start` derrière un reverse proxy, PM2 pour le process) mais demande de gérer soi-même TLS, le redémarrage du process, et le pipeline de déploiement — hors de propos pour la taille actuelle du projet.

### 6.2 Étapes

1. Connecter le dépôt Git du projet à un nouveau projet Vercel (import depuis GitHub/GitLab/Bitbucket).
2. **Settings → Environment Variables** : renseigner les 5 variables du §4.4, en environnement "Production" (et "Preview" séparément si des previews doivent aussi accéder à une base — idéalement une base de préproduction distincte, hors périmètre de cette procédure).
3. Build command et install command : valeurs par défaut de Vercel pour Next.js, rien à changer.
4. Déployer. `next.config.ts` relève déjà la limite de taille des Server Actions à `10mb` (nécessaire pour l'upload de plusieurs photos, voir `listings-setup.md` §5) — aucune configuration Vercel supplémentaire requise pour ça.

### 6.3 Domaine personnalisé

**Settings → Domains** sur le projet Vercel : ajouter le domaine de production, suivre les instructions DNS (enregistrement A/CNAME chez le registrar, ou déléguer les nameservers à Vercel). Une fois actif, revérifier que `NEXT_PUBLIC_APP_URL` (§4.4) et les Redirect URLs Supabase (§4.7) utilisent bien ce domaine final, pas l'URL `*.vercel.app` temporaire.

---

## 7. Dernières vérifications post-déploiement

- [ ] Le domaine de production répond en HTTPS (certificat géré automatiquement par Vercel)
- [ ] Rejouer la checklist de QA manuelle du §3.3 **directement sur le domaine de production**
- [ ] `/mentions-legales` : les champs `siteConfig.legal` (éditeur, hébergeur, directeur de publication) ont bien été complétés avec les vraies informations avant mise en ligne — le bandeau d'avertissement doit avoir disparu (`rgpd-setup.md` §3)
- [ ] Vérifier les logs Vercel (Runtime Logs) et les logs Supabase (Logs Explorer) juste après le déploiement, pour repérer une erreur immédiate passée inaperçue
- [ ] Vérifier le plan Supabase choisi : le plan gratuit met le projet en pause après une semaine d'inactivité et ne fournit pas de sauvegarde quotidienne — passer sur un plan payant avant un vrai lancement si ce n'est pas déjà fait
- [ ] Noter quelque part (gestionnaire de mots de passe de l'équipe) le mot de passe DB de production et la clé SMTP Brevo — jamais dans un fichier du dépôt

---

## 8. Checklist récapitulative

```
[ ] §3.1  Vérifications automatisées (format, tsc, eslint, build) passent
[ ] §3.2  Dernière revue de sécurité effectuée
[ ] §3.3  QA manuelle en local/préprod
[ ] §3.4  Aucun secret dans le code commité
[ ] §4.1  Nouveau projet Supabase créé (mot de passe unique)
[ ] §4.2  PostGIS activé AVANT les migrations
[ ] §4.5  Migrations appliquées (npm run db:migrate)
[ ] §4.6  Buckets Storage provisionnés (npm run storage:setup)
[ ] §4.7  Site URL / Redirect URLs Supabase = domaine de prod
[ ] §4.8  Premier compte admin créé et promu
[ ] §4.9  Seed JAMAIS lancé sur cette base
[ ] §5.2  Domaine vérifié dans Brevo (SPF/DKIM)
[ ] §5.3  SMTP custom configuré côté Supabase
[ ] §5.4  Email de confirmation reçu en test
[ ] §6.2  Variables d'env renseignées sur Vercel, déploiement effectué
[ ] §6.3  Domaine personnalisé actif, NEXT_PUBLIC_APP_URL et Redirect URLs à jour
[ ] §7    QA manuelle rejouée en production
[ ] §7    Mentions légales complétées (plus de bandeau d'avertissement)
[ ] §7    Plan Supabase adapté à un usage réel (pas le plan gratuit qui se met en pause)
```
