# Page détail festival & filtres logements (côté festivalier) — Journal d'implémentation

> Documente le parcours de consultation des logements d'un festival, côté festivalier — pendant que [`listings-setup.md`](listings-setup.md) documente la création côté hôte. Complète [`dbshema.md`](dbshema.md) (modèle de données) et [`admin-setup.md`](admin-setup.md) (modération).

---

## 1. Stack et décisions

- **Card festival cliquable** (page d'accueil) → mène à une page détail par festival, en `/festivals/[slug]` (slug plutôt qu'id : plus lisible, déjà unique en base).
- **Page protégée** : redirige vers `/connexion` si non connecté — cohérent avec la demande initiale ("lorsque je suis connecté, je dois pouvoir visualiser..."). Même pattern que `/compte` et `/logements/nouveau` (`supabase.auth.getUser()` + `redirect`).
- **Filtres en formulaire GET natif**, sans JavaScript client : les valeurs sélectionnées vivent dans l'URL (`searchParams`), la page se ré-exécute côté serveur à chaque soumission. Pas de Client Component nécessaire — cohérent avec le filtrage par statut déjà en place sur `/admin/logements`.

## 2. Fichiers créés / modifiés

| Fichier                                     | Rôle                                                                                               |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `src/app/festivals/[slug]/page.tsx`         | Page détail festival : logements filtrés + formulaire de filtres                                   |
| `src/components/listings/ListingCard.tsx`   | Card logement (infos essentielles)                                                                 |
| `src/components/festivals/FestivalCard.tsx` | Modifié : la card entière devient un `<Link>` vers `/festivals/[slug]`                             |
| `src/lib/listings/constants.ts`             | Ajout de `LISTING_TYPE_LABELS` (labels FR partagés, réutilisés par `ListingForm` et `ListingCard`) |

## 3. Requête et filtres

### Logements affichés

Jointure `listing_festivals` ↔ `listings`, filtrée sur `festival_id` du festival courant **et** `listings.status = 'published'` — un logement `pending_review`/`rejected`/`draft` n'apparaît jamais côté festivalier, cohérent avec le workflow de modération (`dbshema.md` §4.3).

Les photos sont récupérées en une requête séparée (`listing_photos` filtré par `IN (listingIds)`, triée par `position`), la première par logement étant retenue pour la card — même pattern à deux requêtes que la page d'accueil (`src/app/page.tsx`) plutôt qu'une jointure supplémentaire, pour rester simple à ce volume de données.

### Filtres disponibles

| Filtre                  | Logique                                                                                                                                                                                                                                                                                                                              |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Type de logement**    | `listings.type = <valeur>`, liste déroulante basée sur `listingTypeEnum.enumValues`                                                                                                                                                                                                                                                  |
| **Nombre de personnes** | `listings.max_guests >= n` **OU** `listings.spots_total >= n` — un logement n'a jamais les deux renseignés (voir §4.4 de `dbshema.md`), donc le `OR` couvre les deux familles de types sans distinction dans le formulaire. Champ borné à **1–10** (`min`/`max` sur l'`<input>`, revalidé côté serveur), pré-rempli à `1` par défaut |
| **Prix maximum**        | `listings.price_per_night <= n` (`lte`) — champ `€ / nuit`, optionnel, pas de borne haute (juste `min={0}`, `step="0.01"`)                                                                                                                                                                                                           |
| **Navette disponible**  | `listing_festivals.has_shuttle = true`                                                                                                                                                                                                                                                                                               |

_(Historique : un filtre "Prix max / nuit" avait été ajouté puis retiré sur demande explicite dans une itération précédente — il a depuis été redemandé et réintégré à l'identique, voir §8.)_

### UX

- Valeurs des filtres persistées dans l'URL et pré-remplies au rechargement (`defaultValue`/`defaultChecked` sur les champs) — le champ "Nombre de personnes" affiche `1` par défaut tant qu'aucun filtre n'est actif dans l'URL.
- Lien "Réinitialiser" affiché uniquement si au moins un filtre est actif.
- Message distinct entre "aucun logement pour ce festival" (base vide) et "aucun logement ne correspond à ces filtres" (filtres trop restrictifs) — évite de laisser penser que le festival n'a aucune offre alors que c'est le filtrage qui est en cause.

## 4. Mise en page du formulaire de filtres

Grille `grid-cols-1` (mobile) / `sm:grid-cols-5` (desktop, passée de 4 à 5 colonnes avec l'ajout du filtre prix, §8) : Type, Nombre de personnes, Prix maximum, Navette, puis le bouton "Filtrer" (+ "Réinitialiser") dans la 5ᵉ colonne — sur la **même ligne** que les champs en desktop, aligné à droite (`justify-end`) dans sa cellule. Sur mobile, `grid-cols-1` empile chaque champ sur sa propre ligne (un par rangée, plutôt que 2 par rangée) — demandé explicitement pour la lisibilité sur petit écran, cf. §9.

## 5. Comment tester

```bash
npm run dev
```

Connecté, depuis [`/`](http://localhost:3000) : cliquer sur une card festival → arrivée sur `/festivals/<slug>` avec ses logements publiés. Tester les filtres (type, nombre de personnes, prix maximum, navette), vérifier la persistance des valeurs après soumission et le lien "Réinitialiser".

Sans être connecté : cliquer sur une card festival doit rediriger vers `/connexion`.

## 6. Validé lors des tests

- ✅ Navigation carte festival → page détail, logements affichés cohérents avec les compteurs de la page d'accueil (vérifié par requête directe : Dour 2, Hellfest 3, Fusion Festival 1).
- ✅ Filtre "prix ≤ 30 €" sur Hellfest et "capacité ≥ 2" sur Dour vérifiés par requête directe avant intégration au formulaire.
- ✅ Lien retour vers la liste des festivals.
- ✅ Alignement du bouton "Filtrer" sur la même ligne que les champs, confirmé par l'utilisateur.
- ✅ `min`/`max` (1–10) confirmés dans le DOM ; `?guests=50` (hors bornes) traité comme filtre absent, `?guests=5` filtre correctement ; champ pré-rempli à `1` au chargement.

## 7. Revue sécurité

Revue effectuée sur le resserrement des bornes du filtre "Nombre de personnes" (1–10). Diff minimal (validation numérique uniquement, aucune nouvelle surface d'attaque) : **aucune vulnérabilité identifiée.**

`guestsFilter` est dérivé de `Number(filters.guests)` puis passé à `gte()` de Drizzle (requête paramétrée, pas de SQL brut) — pas d'injection possible. Les bornes 1–10 sont revalidées côté serveur (pas seulement via `min`/`max` HTML, qui ne sont qu'une suggestion au navigateur) : une valeur hors bornes dans l'URL (`?guests=50`) est simplement ignorée, sans erreur ni contournement, comme documenté ci-dessus (§6). Le changement est strictement plus restrictif qu'avant (l'ancienne condition acceptait n'importe quel entier positif), donc pas de régression de validation.

## 8. Filtre "Prix maximum" — réintégré

Filtre retiré une première fois sur demande explicite (§3), redemandé plus tard dans le même format (`€ / nuit`, borne haute libre).

- **Champ** : `price`, `type="number"`, `min={0}`, `step="0.01"`, optionnel (pas de valeur pré-remplie, contrairement à "Nombre de personnes").
- **Requête** : `lte(listings.price_per_night, priceFilter.toFixed(2))` — valeur convertie en chaîne à 2 décimales avant d'être passée à Drizzle, même pattern que les autres colonnes `numeric` du projet (`pricePerNight`, `distanceKm`, `shuttleCost` dans `lib/listings/actions.ts`) plutôt qu'un nombre JS brut.
- **Mise en page** : la grille passe de 4 à 5 colonnes en desktop (§4) pour garder les 4 champs + le bouton "Filtrer" sur la même ligne, cohérent avec le choix déjà fait pour les filtres existants.
- **Validation** : `Number.isFinite(priceFilter) && priceFilter > 0` avant d'ajouter la condition — une valeur invalide ou hors sujet (texte, négatif) est simplement ignorée, même logique que les autres filtres numériques de cette page.

Validé en conditions réelles : `?price=20` sur Hellfest (logements à 15 € et 40 €/nuit) → seul le logement à 15 € reste affiché, lien "Réinitialiser" apparaît.

## 9. Une seule ligne en desktop, un champ par ligne en mobile

Demande explicite pour clarifier le comportement responsive du formulaire de filtres : `grid-cols-2` (mobile) remplacé par `grid-cols-1` — les 4 champs (Type, Nombre de personnes, Prix maximum, Navette) et le bouton "Filtrer" s'empilent désormais chacun sur sa propre ligne en dessous de `sm`, plutôt que 2 par rangée. Le comportement desktop (`sm:grid-cols-5`, tout sur une seule ligne, §4/§8) n'est pas modifié.

Validé en conditions réelles (viewport mobile 375×812 puis desktop) : chaque champ occupe bien sa propre ligne en mobile, les 5 éléments restent alignés sur une seule ligne dès `sm`.

## 10. Description du festival

Demande explicite : pouvoir ajouter une description à chaque festival depuis le formulaire de création/édition admin, affichée en partie haute de la page détail festival.

**Modèle de données** : nouvelle colonne `festivals.description` (`text`, NULL) — texte libre, optionnel. Migration [`drizzle/0012_military_logan.sql`](drizzle/0012_military_logan.sql) (simple ajout de colonne, aucune ambiguïté pour `drizzle-kit generate` contrairement à `festival-categories-setup.md` §3).

**Fichiers modifiés** :

- [`src/db/schema.ts`](src/db/schema.ts) — colonne `description`
- [`src/lib/admin/festivals-actions.ts`](src/lib/admin/festivals-actions.ts) — `parseFestivalForm` lit et trim le champ, chaîne vide → `null`
- [`src/components/admin/FestivalForm.tsx`](src/components/admin/FestivalForm.tsx) — `<textarea>` (4 lignes) juste après le Slug, même convention que la description d'un logement (`ListingForm.tsx`)
- [`src/app/admin/festivals/[id]/page.tsx`](src/app/admin/festivals/[id]/page.tsx) — passe `description` en valeur par défaut du formulaire
- [`src/app/festivals/[slug]/page.tsx`](src/app/festivals/[slug]/page.tsx) — affichage conditionnel (si non vide) juste sous la ligne ville/dates, avant le formulaire de filtres — `whitespace-pre-line` pour respecter les retours à la ligne saisis par l'admin
- [`scripts/seed.ts`](scripts/seed.ts) — description ajoutée sur 2 des 4 festivals de démo (volontairement absente sur les 2 autres, pour garder un cas de test sans description)

**Comment tester** : `/admin/festivals/[id]` → remplir "Description" → enregistrer → la description apparaît en haut de `/festivals/[slug]`, juste sous la ligne ville/dates. Un festival sans description n'affiche aucun paragraphe vide.

**Validé lors des tests** :

- ✅ Description saisie sur "Dour Festival" en admin, enregistrée, puis affichée en haut de sa page détail publique après rechargement
- ✅ Festivals sans description n'affichent aucun paragraphe vide
- ✅ `npx tsc --noEmit` et `npx eslint .` propres
- ✅ Migration `0012` appliquée sans erreur sur la base de dev (`npm run db:migrate`)
