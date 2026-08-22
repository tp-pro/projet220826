# Environnement de test (staging) — Procédure

> Déploiement d'un environnement de test/démonstration séparé de la production, sur un sous-domaine existant. Réutilise l'architecture documentée dans [`deploiement-production.md`](deploiement-production.md) (Vercel + Supabase + Brevo) — ce document ne duplique pas les étapes déjà détaillées là-bas, il pointe vers les bonnes sections et détaille surtout la partie spécifique au staging : choix du domaine et configuration DNS côté **O2switch**.

---

## 1. Vue d'ensemble et décisions

| Décision             | Choix                                                                                     | Pourquoi                                                                                                                                                            |
| -------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hébergement de l'app | **Vercel** (comme en prod)                                                                | Aucune raison de diverger de `deploiement-production.md` §6.1 — l'app est pensée pour Vercel (Server Actions/Components), pas pour l'hébergement mutualisé O2switch |
| Rôle d'O2switch      | **DNS uniquement** (Zone Editor)                                                          | Le domaine est déjà chez O2switch ; on ne fait que pointer un sous-domaine vers Vercel, rien d'autre sur l'hébergement O2switch n'est touché                        |
| Domaine              | **Sous-domaine d'un domaine existant** (ex. `staging.tondomaine.fr`), pas d'achat         | Gratuit, immédiat, aucun impact sur le reste du domaine, facile à supprimer plus tard                                                                               |
| Base de données/Auth | **Nouveau projet Supabase dédié**, séparé du projet de dev **et** du futur projet de prod | Même logique que `deploiement-production.md` §4 — jamais réutiliser un projet entre environnements                                                                  |
| Emails               | **Brevo**, même en staging                                                                | Le mailer intégré Supabase est limité à quelques emails/heure — bloquant dès qu'on teste inscription/reset de mot de passe plusieurs fois de suite                  |

Si un nouveau nom de domaine est acheté à la place d'un sous-domaine : mêmes étapes, seule l'étape 5 (DNS) change — soit les mêmes enregistrements DNS chez le nouveau registrar, soit délégation complète des nameservers à Vercel (plus simple si ce domaine ne sert qu'à cette app).

## 2. Nouveau projet Supabase "staging"

Suivre `deploiement-production.md` §4.1 à §4.6, en nommant le projet clairement (ex. `festcamp-staging`) pour ne jamais le confondre avec le projet de dev ou le futur projet de prod :

- [ ] Nouveau projet Supabase créé, PostGIS activé **avant** toute migration (§4.2)
- [ ] "Enable Data API" et "Automatically expose new tables" décochés à la création (§4.1)
- [ ] Clés récupérées (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) — §4.3
- [ ] Connection string **Transaction pooler** (port 6543) récupérée — §4.3
- [ ] `npm run db:migrate` exécuté contre cette base
- [ ] `npm run storage:setup` exécuté (3 buckets créés)

## 3. Déploiement sur Vercel

1. [vercel.com](https://vercel.com) → importer le dépôt Git du projet dans un nouveau projet Vercel
2. **Settings → Environment Variables** :
   ```
   NEXT_PUBLIC_APP_URL=https://staging.tondomaine.fr
   DATABASE_URL=<pooler, étape 2>
   NEXT_PUBLIC_SUPABASE_URL=<étape 2>
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<étape 2>
   SUPABASE_SERVICE_ROLE_KEY=<étape 2>
   ```
3. Déployer — l'URL `*.vercel.app` générée automatiquement permet un premier test avant même de brancher le domaine (§5).

- [ ] Projet Vercel créé, connecté au dépôt
- [ ] Variables d'environnement renseignées
- [ ] Premier déploiement réussi, accessible sur l'URL `*.vercel.app`

## 4. Domaine — sous-domaine recommandé

Voir §1 — `staging.tondomaine.fr` plutôt qu'un achat, sauf besoin spécifique.

## 5. DNS chez O2switch → Vercel

O2switch utilise cPanel, avec un outil "Éditeur de zone" (Zone Editor) pour gérer les enregistrements DNS.

### 5.1 Créer l'enregistrement CNAME côté O2switch

1. Espace client O2switch → accéder au **cPanel** du domaine concerné
2. cPanel → section **Domaines** → **Éditeur de zone** ("Zone Editor")
3. Repérer le domaine (`tondomaine.fr`) dans la liste → **Gérer** ("Manage")
4. **+ Ajouter un enregistrement** ("+ Add Record") → type **CNAME**
5. Renseigner :
   - **Nom** : `staging` (crée `staging.tondomaine.fr`)
   - **Enregistrement/Cible** : `cname.vercel-dns.com.`
   - **TTL** : valeur par défaut
6. Enregistrer

⚠️ Opération **additive uniquement** — n'affecte aucun enregistrement existant du domaine (site principal, MX/emails...), seulement le nouveau sous-domaine `staging`.

### 5.2 Rattacher le domaine côté Vercel

1. Projet Vercel → **Settings → Domains** → **Add** → `staging.tondomaine.fr`
2. Vercel vérifie automatiquement le DNS (de quelques minutes à quelques heures selon la propagation) — une fois validé, certificat HTTPS généré automatiquement

- [ ] Enregistrement CNAME créé dans l'Éditeur de zone O2switch
- [ ] Domaine ajouté et vérifié côté Vercel (cadenas HTTPS actif)
- [ ] `NEXT_PUBLIC_APP_URL` (§3) pointe bien vers `https://staging.tondomaine.fr`, pas l'URL `*.vercel.app` temporaire — redéployer si besoin après correction

## 6. Configuration Auth Supabase — URLs et email templates

Sur le projet Supabase **staging** (§2), pas celui de dev :

1. **Authentication → URL Configuration** : `Site URL` = `https://staging.tondomaine.fr`, ajoutée aussi dans `Redirect URLs` (`deploiement-production.md` §4.7)
2. **Authentication → Email Templates → "Reset Password"** : remplacer le lien `{{ .ConfirmationURL }}` par (piège documenté en `auth-setup.md` §11) :
   ```
   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/mot-de-passe-oublie/nouveau
   ```

- [ ] `Site URL` et `Redirect URLs` mis à jour
- [ ] Template "Reset Password" modifié sur **ce** projet Supabase (jamais reporté automatiquement depuis le projet de dev — chaque projet a ses propres templates)

## 7. Emails — Brevo

Suivre `deploiement-production.md` §5. Si le domaine racine (`tondomaine.fr`) est déjà vérifié dans Brevo (SPF/DKIM) pour un autre usage, **pas besoin de re-vérifier** pour le sous-domaine `staging` — l'adresse d'expédition (ex. `no-reply@tondomaine.fr`) reste valable quel que soit le sous-domaine où tourne l'app qui l'utilise.

- [ ] SMTP custom Brevo configuré côté Supabase (**Authentication → Emails → SMTP Settings**)
- [ ] Domaine d'expédition vérifié dans Brevo (ou déjà vérifié pour un autre usage)

## 8. Premier compte admin + QA

1. S'inscrire normalement sur `https://staging.tondomaine.fr/inscription`
2. Confirmer l'email reçu (teste Brevo au passage, §7)
3. Dans Supabase (projet **staging**) → **SQL Editor** :
   ```sql
   update public.users set role = 'admin' where email = 'ton-email@exemple.fr';
   ```
4. Rejouer la checklist de QA manuelle de `deploiement-production.md` §3.3 (couvre déjà les parcours suppression de logement/compte et réinitialisation de mot de passe)

- [ ] Compte admin créé et promu
- [ ] Checklist QA de `deploiement-production.md` §3.3 rejouée intégralement sur `staging.tondomaine.fr`

## 9. Différences avec une vraie mise en production

Ne pas oublier avant un vrai lancement (hors périmètre de cet environnement de test) :

- Mentions légales (`rgpd-setup.md` §3, `deploiement-production.md` §7) — un environnement de staging peut rester avec le bandeau d'avertissement, pas la prod
- Plan Supabase payant (le plan gratuit met le projet en pause après une semaine d'inactivité, `deploiement-production.md` §7) — généralement pas nécessaire pour du staging, à surveiller si le projet reste inactif entre deux sessions de test
- `scripts/seed.ts` reste interdit sur staging comme en prod si des vraies personnes doivent tester dessus (mots de passe de test connus, `auth-setup.md` §5) — sinon, l'utiliser librement pour peupler l'environnement de test avec des données réalistes
