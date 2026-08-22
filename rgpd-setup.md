# RGPD & mentions légales — Journal d'implémentation

> Documente les pages `/mentions-legales` et `/politique-de-confidentialite`, liées depuis le footer. Complète [`dbshema.md`](dbshema.md) (modèle de données — source de vérité sur les champs réellement collectés) et [`design-setup.md`](design-setup.md) (tokens visuels réutilisés).

---

## 1. Portée

Deux pages distinctes, volontairement pas fusionnées bien que souvent demandées ensemble :

- **`/politique-de-confidentialite`** — seule page réellement exigée par le RGPD : décrit les données collectées, leur finalité, leur base légale, qui y a accès, la durée de conservation et les droits des utilisateurs.
- **`/mentions-legales`** — exigée par la LCEN (droit français de l'économie numérique), pas par le RGPD à proprement parler, mais quasi-systématiquement attendue au même endroit sur un site avec comptes utilisateurs : identité de l'éditeur, hébergeur, propriété intellectuelle.

Pas de page « Cookies » séparée : l'app ne dépose qu'un cookie de session strictement nécessaire à l'authentification (Supabase Auth), pas de tracking ni de publicité — ce cas est couvert par une section dédiée à l'intérieur de la politique de confidentialité (§7) plutôt que par une bannière de consentement, qui n'est pas requise pour des cookies strictement nécessaires.

**Hors périmètre pour l'instant** : Conditions Générales d'Utilisation (CGU/CGV) — pas exigées par le RGPD, plus proche d'un document produit/contractuel (politique d'annulation, obligations réciproques hôte/festivalier) qu'un besoin de conformité pure. Piste v2 si le besoin se confirme.

## 2. Fichiers créés / modifiés

| Fichier                                         | Rôle                                                                                               |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `src/app/politique-de-confidentialite/page.tsx` | Politique de confidentialité (RGPD)                                                                |
| `src/app/mentions-legales/page.tsx`             | Mentions légales (LCEN)                                                                            |
| `src/config/site.ts`                            | Ajout de `siteConfig.legal` — coordonnées de l'éditeur, réutilisées par les deux pages             |
| `src/components/layout/Footer.tsx`              | Ajout des deux liens, affichés sur toutes les pages (le `Footer` est déjà global via `layout.tsx`) |

## 3. ⚠️ Ce qui reste à compléter avant mise en ligne

Le contenu de **ce que fait réellement l'application** (données collectées, finalités, sécurité) est décrit avec précision, dérivé du schéma de données réel (`dbshema.md`) et des fonctionnalités existantes (justificatif de domicile en bucket privé, mise en relation, modération...). En revanche, certains champs ne peuvent **pas** être déduits du code et sont laissés en placeholders explicites dans `siteConfig.legal` :

```ts
legal: {
  editorName: '[Nom / raison sociale de l’éditeur — à compléter]',
  editorAddress: '[Adresse de l’éditeur — à compléter]',
  publicationDirector: '[Nom du directeur de la publication — à compléter]',
  hostName: '[Nom et adresse de l’hébergeur — à compléter]',
  contactEmail: 'contact@festcamp.test',
}
```

Ces informations d'identité (raison sociale, adresse, hébergeur réel du site — ex. Vercel — en plus de Supabase déjà mentionné pour la base de données/auth/stockage) dépendent de qui exploite réellement le site et où il est déployé ; les inventer aurait rendu les mentions légales trompeuses. **Les deux pages affichent un bandeau d'avertissement visible** tant que ces champs n'ont pas été renseignés, pour qu'il soit impossible de les publier par erreur sans s'en rendre compte.

À vérifier également avant mise en ligne (dépend de la configuration réelle du projet Supabase, pas déductible du code applicatif) :

- **Localisation d'hébergement** (UE ou hors UE) — conditionne si une clause de transfert hors UE est nécessaire dans la politique de confidentialité.
- **Durée de conservation exacte** après suppression d'un compte — la page indique un « délai raisonnable », à préciser si une politique de rétention formelle est définie.

## 4. Contenu de la politique de confidentialité — d'où viennent les données décrites

Le §2 (données collectées) reflète fidèlement le schéma `listings`/`users`/`bookings`/`reviews` documenté dans `dbshema.md` — pas de champ générique ou inventé :

- Compte (`users`) : email, nom complet, téléphone, avatar, bio, ville, date de naissance (sert uniquement à calculer l'âge affiché, jamais exposée en clair — cf. `dbshema.md` §3.1).
- Logement (`listings`) : titre, description, adresse, ville, pays, photos, équipements, prix.
- **Justificatif de domicile** (`listings.certification_document_path`) : mentionné explicitement comme donnée sensible, stockage privé, accès admin uniquement — cohérent avec `listings-setup.md` §9 et §13 (revue sécurité).
- Mise en relation (`bookings`) et avis (`reviews`) : message, note, commentaire.

Le §9 (droits RGPD) liste les droits accès/rectification/effacement/limitation/opposition/portabilité (art. 15 à 21 RGPD) avec un renvoi vers `/compte` pour la rectification directe (déjà possible pour ville/date de naissance, cf. `booking-requests-setup.md` §5) et un contact pour le reste.

## 5. Comment tester

```bash
npm run dev
```

- Le footer affiche les deux liens sur toutes les pages (composant global, cf. `layout.tsx`).
- [`/mentions-legales`](http://localhost:3000/mentions-legales) et [`/politique-de-confidentialite`](http://localhost:3000/politique-de-confidentialite) — vérifier que le bandeau d'avertissement reste visible tant que `siteConfig.legal` contient des placeholders.

## 6. Validé lors des tests

- ✅ Liens du footer visibles sur la page d'accueil, mènent aux bonnes pages.
- ✅ Les deux pages se rendent correctement (screenshot), bandeau d'avertissement visible.
- ✅ `tsc --noEmit` et `eslint` propres.
