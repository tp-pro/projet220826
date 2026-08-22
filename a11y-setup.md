# Accessibilité numérique (RGAA) — Journal d'implémentation

> Documente la passe d'accessibilité appliquée à l'ensemble du projet. Un audit RGAA complet (106 critères, 13 thématiques) nécessite des tests manuels (lecteur d'écran, navigation clavier bout-en-bout, zoom 200 %) non réalisables dans cette session — cette passe couvre tout ce qui est vérifiable et corrigeable directement dans le code.

---

## 1. Portée de la passe

Corrigé/ajouté sur l'ensemble du projet (24 fichiers) :

1. Navigation clavier (lien d'évitement, `aria-current`, landmarks nommés)
2. Contraste des couleurs (`text-gray-400` en mode clair)
3. Annonces dynamiques (`role="alert"` / `role="status"`) sur les messages de formulaire
4. Sémantique des formulaires (`fieldset`/`legend`, `aria-label`)
5. Textes alternatifs différenciés (galerie photo)
6. Titres de page distincts (`<title>` unique par route)

Explicitement **hors périmètre** (nécessite un audit humain) : voir §7.

Ajout ultérieur, hors de cette première passe : fil d'Ariane sur l'ensemble des pages sauf l'accueil — voir §10.

## 2. Navigation clavier

- **Lien d'évitement** ajouté dans `src/app/layout.tsx` : invisible par défaut (`sr-only`), apparaît au focus clavier (`focus:not-sr-only`), pointe vers `#main-content`.
- `<main id="main-content" tabIndex={-1}>` — cible focusable par le lien d'évitement (un `<main>` n'est pas focusable nativement sans `tabIndex`).
- **`aria-current="page"`** sur l'onglet actif du `RoleSwitcher` (`src/components/layout/RoleSwitcher.tsx`) — l'état actif ne reposait auparavant que sur la couleur/graisse du texte, insuffisant pour un lecteur d'écran (et un utilisateur en mode contraste élevé).
- `RoleSwitcher` transformé en élément `<nav aria-label="Changer de profil">` et le menu du `Header` a reçu `aria-label="Navigation principale"` — deux `<nav>` imbriqués doivent avoir un nom accessible distinct pour être différenciables à la navigation par landmarks.

## 3. Contraste des couleurs

`text-gray-400` (~2,85:1 sur fond blanc) est **sous le seuil WCAG AA** (4,5:1 texte normal). Deux cas distincts identifiés :

- **`dark:text-gray-400`** (associé à un `text-gray-600`/`700` en mode clair) : **déjà conforme**, gray-400 sur fond sombre a un contraste suffisant — non modifié.
- **`text-gray-400` sans variante claire**, ou `text-gray-500` isolé sur du texte de petite taille (`text-xs`, souvent en position de libellé important) : corrigé dans **7 fichiers** (`ListingForm.tsx`, `ProfileForm.tsx`, `ListingCard.tsx`, la fiche logement) — remplacé par `text-gray-500 dark:text-gray-400` (si absent) ou `text-gray-600` (marge de sécurité sur du texte déjà à la limite).

## 4. Annonces dynamiques (`role="alert"` / `role="status"`)

Tous les messages de formulaire pilotés par `useActionState` (donc affichés/mis à jour **sans rechargement de page**) ont reçu :

- `role="alert"` sur les messages d'erreur (`aria-live="assertive"` implicite — interruption immédiate, cohérent avec la gravité d'une erreur de saisie)
- `role="status"` sur les messages de succès (`aria-live="polite"` implicite — annoncé sans interrompre)

Concerné : `SignInForm`, `SignUpForm`, `ListingForm` (erreur de formulaire + erreur de sélection de photos), `ProfileForm`, `FestivalForm` (admin), `RequestBookingForm`, `BookingRequestActions` (accepter/refuser).

**Non concerné, volontairement** : les affichages de motif de refus déjà présents dans le HTML au chargement de la page (ex: `/mes-demandes`, `/logements/demandes`, `/admin/logements`) — ce sont des re-rendus serveur complets via `revalidatePath`, pas des mises à jour client dynamiques ; un lecteur d'écran les rencontre normalement au fil de la lecture de la page.

## 5. Sémantique des formulaires

- Groupe de 10 cases à cocher "Équipements proposés" (`ListingForm.tsx`) : `<span>` remplacé par `<fieldset><legend>` — un groupe de contrôles liés doit être annoncé comme tel, pas seulement précédé d'un texte visuel.
- Formulaire de filtres (`/festivals/[slug]`) : `aria-label="Filtrer les logements"` ajouté sur le `<form>`.

## 6. Textes alternatifs et titres de page

- **Galerie photo** de la fiche logement (`/logements/[id]`) : chaque `<img>` avait le même `alt={listing.title}` répété — un lecteur d'écran lisait donc la même description pour chaque photo sans pouvoir les différencier. Remplacé par `"Photo {n} sur {total} — {titre}"`.
- **Titres de page** : `src/app/layout.tsx` utilise désormais `title: { default, template: "%s | {site}" }`. Chaque route définit son propre titre via `export const metadata` (pages statiques) ou `generateMetadata` (routes dynamiques `/logements/[id]`, `/festivals/[slug]`, `/admin/festivals/[id]`) — avant cette passe, toutes les pages partageaient le même `<title>`, ce qui empêche de distinguer les onglets/l'historique pour un utilisateur de lecteur d'écran (qui s'appuie beaucoup sur le titre de page pour s'orienter).

## 7. Point corrigé en cours de revue sécurité

Les deux `generateMetadata` (`/logements/[id]`, `/festivals/[slug]`) ne filtraient pas par `status = 'published'`, contrairement à la page elle-même — le titre d'un logement/festival non publié aurait pu fuiter dans la balise `<title>` malgré un contenu de page en 404. Corrigé en répliquant le même filtre `status` que la page. Voir aussi `dbshema.md` §4.3 (workflow de modération).

## 8. Hors périmètre — audit humain nécessaire

- Test réel au lecteur d'écran (NVDA, VoiceOver, JAWS) sur les parcours complets
- Navigation 100 % clavier bout-en-bout (tab order, pièges au focus)
- Contraste exhaustif de **toutes** les combinaisons de couleurs (seul le cas systématique `text-gray-400` a été corrigé)
- Zoom 200 % / reflow, préférences `prefers-reduced-motion`
- Validation avec un outil d'audit automatisé (axe, Lighthouse, ou l'outil officiel RGAA) pour confirmer la conformité sur les 106 critères

## 9. Comment vérifier rapidement

```bash
npm run dev
```

- Ouvrir n'importe quelle page et appuyer sur `Tab` dès le chargement → le lien "Aller au contenu principal" doit apparaître en premier
- Onglet actif du switcher Festivalier/Hôte : inspecter le DOM, vérifier `aria-current="page"`
- Fil d'Ariane : présent sur n'importe quelle page sauf `/`, absent sur `/` — inspecter le DOM, vérifier `aria-current="page"` sur le dernier élément (voir §10)

## 10. Fil d'Ariane (Breadcrumbs)

Ajouté sur **toutes les pages sauf l'accueil** (`/`, qui est la racine du fil — rien à afficher au-dessus). Pattern [WAI-ARIA "Breadcrumb"](https://www.w3.org/WAI/ARIA/apg/patterns/breadcrumb/) : `<nav aria-label="Fil d'Ariane">` contenant une liste ordonnée de liens, le dernier élément (page courante) marqué `aria-current="page"` et rendu en texte simple plutôt qu'en lien.

### Fichier

`src/components/layout/Breadcrumbs.tsx` — composant partagé, prend un prop `items: { label: string; href?: string }[]` correspondant à la **suite** du fil : le préfixe `{ label: 'Accueil', href: '/' }` est ajouté automatiquement par le composant, chaque page ne fournit que ses propres niveaux.

### Où et comment

Rendu explicitement dans chacune des 20 autres pages (`src/app/**/page.tsx`), en tout début de contenu — pas d'auto-génération à partir du chemin d'URL (qui aurait produit des libellés bruts illisibles pour les routes dynamiques, ex. un slug ou un UUID plutôt qu'un nom de festival ou un titre de logement). Chaque page construit donc son propre fil, avec des libellés lisibles :

| Zone                                                                                                                                                          | Exemple de fil                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Pages statiques (`/contact`, `/mentions-legales`...)                                                                                                          | Accueil / Contact                                                                                                                      |
| Fiche festival                                                                                                                                                | Accueil / _Nom du festival_                                                                                                            |
| Fiche logement                                                                                                                                                | Accueil / _Nom du festival_ / _Titre du logement_ (le festival est omis si le logement n'en a pas)                                     |
| Pages liées au compte (`/logements/[id]/modifier`, `/mes-demandes`, `/logements/demandes`)                                                                    | Accueil / Mon compte / _Page_                                                                                                          |
| Pages admin                                                                                                                                                   | Accueil / Administration / _Section_ (+ un niveau supplémentaire pour les sous-pages, ex. Administration / Festivals / Modifier _Nom_) |
| Pages par catégorie de festival (`/festivals/musique`, `/festivals/litteraire`, ajoutées après cette passe initiale — voir `festival-categories-setup.md` §9) | Accueil / Festivals de musique                                                                                                         |

`/admin` lui-même ne rend jamais de contenu (redirige immédiatement vers `/admin/logements`) — pas de fil d'Ariane nécessaire là. Les deux pages par catégorie le reçoivent via le composant partagé `CategoryFestivalsPage` plutôt que directement dans leur `page.tsx` (wrapper fin, voir `festival-categories-setup.md` §9), mais suivent le même pattern.

### Validé lors des tests

- ✅ Absent sur `/`, présent sur les 20 autres pages (vérifié en conditions réelles, connecté hôte puis admin ; les 2 pages par catégorie ajoutées après cette passe suivent le même pattern via `CategoryFestivalsPage`).
- ✅ Dernier élément marqué `aria-current="page"`, rendu en texte non cliquable ; les éléments précédents sont de vrais liens (`<a href>`), vérifiés dans le DOM.
- ✅ Fil à 3 niveaux (fiche logement avec festival) et 4 niveaux (`/admin/festivals/[id]`) corrects.
- ✅ `tsc --noEmit` et `eslint` propres.
- Onglet du navigateur : chaque page doit avoir un titre différent (ex: "Connexion | Mon Starter Next.js")
- Déclencher une erreur de formulaire (ex: connexion avec mauvais mot de passe) avec un lecteur d'écran actif → le message doit être annoncé automatiquement
