# Formulaire de contact — Journal d'implémentation

> Documente la page `/contact`, liée depuis le footer. Complète [`rgpd-setup.md`](rgpd-setup.md) (la politique de confidentialité mentionne ce formulaire comme source de données) et [`dbshema.md`](dbshema.md) (nouvelle table `contact_messages`).

---

## 1. Stack et décisions

- Formulaire = **Client Component** (`ContactForm.tsx`) piloté par `useActionState`, soumis à une **Server Action** (`sendContactMessageAction`) — même pattern que `SignUpForm`/`SignInForm` (`auth-setup.md`).
- **Page publique**, pas de connexion requise — cohérent avec le reste des pages d'information (`/mentions-legales`, `/politique-de-confidentialite`, accueil).
- **Pas d'envoi d'email** : aucun service d'envoi (Resend, SMTP...) n'est configuré dans le projet pour l'instant. Le message est simplement **persisté en base** (table `contact_messages`), consultable par un admin sur `/admin/messages` — même logique que l'absence de notifications temps réel documentée dans `booking-requests-setup.md` §4 (consulter une page dédiée plutôt qu'une infra de notification/envoi). Piste v2 si un envoi d'email de confirmation ou d'alerte devient nécessaire.
- **Pas d'anti-spam** (ni honeypot, ni rate limiting) pour rester simple, comme demandé. À revoir si le formulaire subit du spam en usage réel.

## 2. Fichiers créés

| Fichier                                         | Rôle                                                                                                                         |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `src/db/schema.ts`                              | Table `contact_messages` (`name`, `email`, `message`, `created_at`) — pas de `user_id`, un visiteur non connecté peut écrire |
| `drizzle/0009_bizarre_toxin.sql`                | Migration correspondante                                                                                                     |
| `src/lib/contact/types.ts`                      | `ContactActionState` — même forme que `AuthActionState`                                                                      |
| `src/lib/contact/actions.ts`                    | `sendContactMessageAction` — validation minimale (champs requis, format email) + insertion                                   |
| `src/components/contact/ContactForm.tsx`        | Formulaire (Client Component) — nom, email, message                                                                          |
| `src/app/contact/page.tsx`                      | Page publique                                                                                                                |
| `src/app/admin/messages/page.tsx`               | Liste des messages reçus, du plus récent au plus ancien, protégée par `admin/layout.tsx`                                     |
| `src/app/admin/layout.tsx`                      | Ajout du lien de nav « Messages »                                                                                            |
| `src/components/layout/Footer.tsx`              | Ajout du lien « Contact »                                                                                                    |
| `src/app/politique-de-confidentialite/page.tsx` | Ajout d'une entrée « Formulaire de contact » dans les données collectées (§2)                                                |

## 3. Comment tester

```bash
npm run dev
```

- [`/contact`](http://localhost:3000/contact) : remplir et envoyer → message de succès affiché.
- [`/admin/messages`](http://localhost:3000/admin/messages) (connecté admin) : le message envoyé apparaît, avec nom, email (lien `mailto:`) et date.

## 4. Validé lors des tests

- ✅ Soumission réelle du formulaire → message inséré en base (vérifié par requête directe).
- ✅ Message visible sur `/admin/messages` après connexion admin.
- ✅ Lien « Contact » présent dans le footer sur toutes les pages.
- ✅ `tsc --noEmit` et `eslint` propres.

## 5. Revue sécurité

Revue dédiée effectuée sur l'ensemble de cette fonctionnalité : **aucune vulnérabilité HIGH confirmée.**

Points vérifiés :

- **Pas d'injection SQL** : `sendContactMessageAction` (insertion) et `AdminMessagesPage` (lecture) passent exclusivement par Drizzle ORM avec requêtes paramétrées, même pattern que le reste du projet.
- **Pas de XSS** : `name`/`message` sont rendus comme du texte React classique (auto-échappé) — aucun `dangerouslySetInnerHTML` introduit.
- **Accès admin correctement protégé** : `/admin/messages` est une page normale sous `src/app/admin/`, donc enveloppée par `admin/layout.tsx` qui appelle `requireAdmin()` avant tout rendu — même garantie que `/admin/hotes`. Contrairement aux Route Handlers (`justificatif/route.ts`, cf. `listings-setup.md` §13), une page Server Component hérite bien de la protection de son layout ; pas de vérification explicite supplémentaire nécessaire ici, aucune Server Action admin n'étant ajoutée par cette fonctionnalité.
- **Pas de fuite d'info** : `sendContactMessageAction` ne renvoie que des messages d'erreur génériques fixes à l'appelant non authentifié, jamais le détail d'une erreur base de données.

**Point corrigé suite à la revue** : la validation de l'email (`email.includes('@')`) était trop permissive — un visiteur pouvait soumettre une valeur comme `victime@example.com?bcc=attaquant@evil.com`, stockée telle quelle puis réinjectée sans échappement dans le lien mailto généré pour l'admin sur `/admin/messages`. Un admin cliquant sur ce lien pour répondre aurait pu se retrouver avec un champ `bcc`, `subject` ou `body` pré-rempli à son insu dans son client mail. Impact jugé faible (nécessite que l'admin clique le lien puis envoie sans remarquer les champs pré-remplis, pas d'exfiltration ni d'exécution automatique), mais le correctif étant trivial il a été appliqué par prudence : la constante `EMAIL_PATTERN` dans `src/lib/contact/actions.ts` rejette désormais les caractères `?` et `&` ainsi que les espaces, et exige un format `x@y.z` minimal, avant que la valeur n'atteigne la base puis le lien mailto.
