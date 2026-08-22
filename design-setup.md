# Direction design "Balise" — Journal d'implémentation

> Documente la mise en place de l'identité visuelle du produit (palette, typographie, composants de base), qui remplace le gris Tailwind par défaut du starter sur les écrans les plus visibles. Complète [`listings-setup.md`](listings-setup.md) (bandeau de statut, cards) et [`booking-requests-setup.md`](booking-requests-setup.md) (badges de disponibilité) — les deux fonctionnalités qui consomment ces tokens.

---

## 1. Contexte et choix de direction

Deux pistes visuelles ont été proposées avant tout code (comparateur interactif, échangé en conversation, non versionné dans le dépôt) :

- **Lanterne** — chaleur de l'accueil, toile de tente et lumière de lanterne au crépuscule. Pensée pour porter les écrans où il faut donner envie de faire confiance (accueil, fiche logement, profil hôte).
- **Balise** — repérage et carte de terrain, inspirée des drapeaux plantés dans un camping de festival pour retrouver sa tente. Pensée pour les écrans de recherche/logistique (filtres, distance, navette).

**Balise** a été retenue comme identité unique pour la V1 (plutôt que l'hybride envisagé) — moins de tokens à maintenir, un seul système de composants. Palette **claire uniquement** ; le mode sombre n'est pas construit pour l'instant (`color-scheme: light` explicite dans `globals.css`).

## 2. Fichiers créés / modifiés

| Fichier                                     | Rôle                                                                                                            |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `src/app/globals.css`                       | Tokens Tailwind v4 (`@theme`), chargement des polices, styles de base, motif `.bg-topo`                         |
| `src/app/layout.tsx`                        | Chargement des polices (`next/font/google`)                                                                     |
| `src/config/site.ts`                        | Nom/description du site (`Festcamp`) — portait encore les valeurs par défaut du starter (`Mon Starter Next.js`) |
| `src/components/ui/Button.tsx`              | Primitive bouton (`Button`, `buttonClass`)                                                                      |
| `src/components/ui/Badge.tsx`               | Primitive badge de statut                                                                                       |
| `src/components/layout/Header.tsx`          | Recoloré, wordmark en police d'affichage, "Inscription" en bouton                                               |
| `src/components/layout/Footer.tsx`          | Recoloré                                                                                                        |
| `src/components/layout/RoleSwitcher.tsx`    | Recoloré (accent beacon pour l'onglet actif)                                                                    |
| `src/components/festivals/FestivalCard.tsx` | Recoloré, motif `.bg-topo` en repli photo                                                                       |
| `src/components/listings/ListingCard.tsx`   | Recoloré, prix/type en police mono, badges de statut (voir `booking-requests-setup.md` §8)                      |

`src/components/ui/` était vide (`.gitkeep` seulement) avant cette passe — premier usage de ce dossier prévu par la structure du starter pour les "composants génériques réutilisables".

## 3. Tokens (`src/app/globals.css`)

### Palette

| Token                                    | Valeur                | Rôle                                                                                                    |
| ---------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------- |
| `--color-paper`                          | `#f1f2ec`             | Fond de page — papier de carte, teinte volontairement grise/verte plutôt qu'un blanc ou crème générique |
| `--color-surface`                        | `#ffffff`             | Cartes, panneaux, formulaires                                                                           |
| `--color-map`                            | `#dde0d6`             | Bandeaux, zones mises en avant                                                                          |
| `--color-ink`                            | `#1f2a24`             | Texte principal                                                                                         |
| `--color-contour`                        | `#445b4f`             | Texte secondaire                                                                                        |
| `--color-muted`                          | `#66756c`             | Texte tertiaire, placeholders                                                                           |
| `--color-beacon` / `--color-beacon-dark` | `#2c6e8e` / `#1f5470` | Accent principal — liens, CTA, focus, hover                                                             |
| `--color-blaze`                          | `#c4922b`             | Accent secondaire — badges, mise en avant (ex : navette)                                                |
| `--color-border`                         | `#c9d0c2`             | Bordures                                                                                                |
| `--color-success` / `--color-danger`     | `#3f7d5c` / `#b23b3b` | États sémantiques (statuts de logement, badges de réservation)                                          |

Déclarés dans un bloc `@theme` (pas `:root`) : Tailwind v4 génère automatiquement les utilitaires (`bg-beacon`, `text-contour`, `border-border`, `bg-danger/15`...) à partir de ces `--color-*`, sans configuration supplémentaire.

### Typographie

- **Titrage** (`--font-display` = [Jost](https://fonts.google.com/specimen/Jost), via `next/font/google`) : géométrique, dans l'esprit d'une signalétique de sentier plutôt qu'une police d'interface générique. Appliqué automatiquement à `h1`/`h2`/`h3` via `@layer base` — pas besoin d'ajouter une classe à chaque titre.
- **Corps** (`--font-sans` = [Public Sans](https://fonts.google.com/specimen/Public+Sans)) : humaniste, sobre — développée à l'origine pour le design system des services publics américains (USWDS), cohérente avec le ton "carte/repérage" de la direction.
- **Données chiffrées** (prix, distances, type de logement sur les cards) : police mono système (`font-mono`, pile par défaut de Tailwind) — pas de police supplémentaire chargée, l'usage est trop ponctuel pour le justifier.

Polices choisies pour éviter les valeurs par défaut génériques (Inter, Space Grotesk) — cohérent avec les deux pistes proposées, qui partaient toutes les deux de l'univers concret du camping de festival plutôt que de conventions d'interface neutres.

### Pourquoi `@layer base` pour les styles globaux

Dans Tailwind v4, tout CSS **non déclaré dans un `@layer`** passe avant les classes utilitaires dans la cascade, quelle que soit la spécificité (les cascade layers CSS font toujours gagner le non-layered sur le layered). Un premier passage avait laissé `body`/`a`/`::selection`/`:focus-visible` hors de tout layer — résultat : la règle `a { color: var(--color-beacon) }` écrasait la classe utilitaire `text-surface` sur le libellé actif du `RoleSwitcher` (texte bleu sur fond bleu, invisible — rapporté par l'utilisateur avec une capture d'écran). Correction : tout déplacé dans `@layer base`, où les classes utilitaires (`@layer utilities`, généré par `@import 'tailwindcss'`) peuvent normalement les surcharger.

## 4. Composants de base (`src/components/ui/`)

- **`Button`** / **`buttonClass(variant, className?)`** — variantes `primary` (fond beacon), `secondary` (bordure contour), `ghost`, `danger`. Exposé comme fonction retournant une className plutôt qu'un composant polymorphe imposé, pour s'appliquer aussi bien à un `<button>` qu'à un `<Link>` (`className={buttonClass('secondary')}`) — cohérent avec le reste du code, qui n'utilise pas `clsx`/`cva`.
- **`Badge`** — variantes `type`, `shuttle`, `success`, `danger`, `pending`, `muted`. Couleurs en teinte (`bg-*/15` + `border-*/40` + `text-*`) plutôt qu'en aplat, pour rester lisibles sans dominer une card. La variante `pending` (fond beacon clair) est réutilisée telle quelle pour le bandeau de statut du formulaire d'édition (`listings-setup.md` §8) — même code couleur, même sémantique.

## 5. Motif `.bg-topo`

Repli visuel pour les cards sans photo (festival ou logement) : anneaux concentriques en `repeating-radial-gradient` (CSS pur, pas d'image ni de SVG dessiné à la main), rappelant des courbes de niveau topographiques — cohérent avec le concept de carte de terrain de la direction.

## 6. Comment tester

```bash
npm run dev
```

- Accueil, fiche festival, fiche logement : palette/typo cohérentes ; cards sans photo affichent le motif `.bg-topo`.
- Connecté, alterner Festivalier/Hôte via le switch dans le header : le libellé actif doit rester lisible (texte blanc sur fond beacon).

## 7. Validé lors des tests

- ✅ Rendu vérifié en direct sur accueil, fiche festival + logements, page compte (navigateur intégré, plusieurs comptes de test).
- ✅ Bug de contraste texte/fond sur le `RoleSwitcher` actif identifié (capture d'écran fournie par l'utilisateur) et corrigé — voir §3.
- ✅ `tsc`/`eslint`/`prettier` clean sur l'ensemble des fichiers.

⚠️ **Périmètre non couvert par cette passe** : formulaires (connexion/inscription/création-édition de logement au-delà du bandeau de statut, profil), dashboard admin, flow de mise en relation au-delà des badges déjà documentés dans `booking-requests-setup.md` §8 — gardent le gris Tailwind par défaut du starter. Prochaine étape naturelle si la direction est confirmée : propager les tokens à ces écrans.
