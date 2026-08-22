-- Évolution du modèle de tarification : le prix du logement passe d'un forfait pour la durée
-- du séjour à un prix par nuit et par voyageur (voir dbshema.md §4.2).
-- RENAME COLUMN (et non drop+add) pour préserver les données déjà en base.
ALTER TABLE "listings" RENAME COLUMN "price_default" TO "price_per_night";
