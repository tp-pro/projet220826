'use client';

import { useActionState, useEffect, useMemo, useRef, useState } from 'react';

import type { CreateListingActionState } from '@/lib/listings/actions';
import {
  ALLOWED_CERTIFICATION_DOC_TYPES,
  ALLOWED_PHOTO_TYPES,
  MAX_CERTIFICATION_DOC_SIZE_BYTES,
  MAX_LISTING_PHOTOS,
} from '@/lib/listings/constants';

const LISTING_TYPES = [
  { value: 'entire_place', label: 'Logement entier' },
  { value: 'private_room', label: 'Chambre privée' },
  { value: 'camping_spot', label: 'Camping / emplacement' },
  { value: 'glamping', label: 'Glamping / tente équipée' },
  { value: 'couch', label: 'Canapé' },
] as const;

const BLOCKING_TYPES = new Set(['entire_place', 'private_room']);

const GUEST_COUNT_MIN = 2;
const GUEST_COUNT_MAX = 10;

/**
 * Corrige la valeur au blur plutôt que de compter sur la bulle de validation native du
 * navigateur (`min`/`max` HTML) : celle-ci n'empêche pas de *taper* 1, seulement de *soumettre*
 * le formulaire, et sa bulle peut se chevaucher de façon confuse avec celle d'un autre champ
 * invalide (ex : "Ville" vide) — retour utilisateur direct sur ce point. Ici, la valeur est
 * ramenée dans les bornes dès que le champ perd le focus, avant même toute tentative de
 * soumission ; `min`/`max` restent en plus sur l'input pour le curseur natif et comme filet de
 * sécurité si `onBlur` ne se déclenche pas (ex : soumission au clavier sans quitter le champ).
 */
function clampGuestCountInput(e: React.FocusEvent<HTMLInputElement>) {
  const raw = e.target.value;
  if (raw === '') return; // champ vide : laisser `required` gérer ce cas
  const value = Number(raw);
  if (!Number.isFinite(value)) return;
  if (value < GUEST_COUNT_MIN) e.target.value = String(GUEST_COUNT_MIN);
  else if (value > GUEST_COUNT_MAX) e.target.value = String(GUEST_COUNT_MAX);
}

const AMENITIES = [
  'Wifi',
  'Parking',
  'Douche',
  'Cuisine équipée',
  'Draps fournis',
  'Chauffage',
  'Électricité',
  'Point d’eau à proximité',
  'Animaux acceptés',
  'Accès PMR',
] as const;

type FestivalOption = {
  id: string;
  name: string;
  city: string;
  country: string;
};

type ExistingPhoto = { id: string; url: string };

export type ListingFormDefaultValues = {
  id: string;
  title: string;
  description: string | null;
  address: string | null;
  city: string;
  country: string;
  type: (typeof LISTING_TYPES)[number]['value'];
  minGuests: number | null;
  maxGuests: number | null;
  spotsTotal: number | null;
  pricePerNight: string | null;
  amenities: string[];
  festivalId: string | null;
  distanceKm: string | null;
  hasShuttle: boolean;
  shuttleCost: string;
  /** 0 = uniquement pendant les dates du festival, 1 = ± 1 jour (arrivée avant, départ après). */
  arrivalBufferDays: number;
  photos: ExistingPhoto[];
  hasCertificationDocument: boolean;
};

const inputClass =
  'mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-transparent';

export function ListingForm({
  festivals,
  action,
  defaultValues,
  submitLabel = 'Soumettre le logement',
  successMessage = 'Logement soumis avec succès — il est maintenant en attente de validation par un administrateur avant de devenir visible publiquement.',
}: {
  festivals: FestivalOption[];
  action: (
    prevState: CreateListingActionState,
    formData: FormData
  ) => Promise<CreateListingActionState>;
  defaultValues?: ListingFormDefaultValues;
  submitLabel?: string;
  successMessage?: string;
}) {
  const [state, formAction, pending] = useActionState(action, {
    error: null,
    success: false,
  });
  const [type, setType] = useState<(typeof LISTING_TYPES)[number]['value']>(
    defaultValues?.type ?? 'entire_place'
  );
  const [hasShuttle, setHasShuttle] = useState(defaultValues?.hasShuttle ?? false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [photos, setPhotos] = useState<File[]>([]);
  const [existingPhotos, setExistingPhotos] = useState<ExistingPhoto[]>(
    defaultValues?.photos ?? []
  );
  const [certificationDocError, setCertificationDocError] = useState<string | null>(null);
  const [certificationDocFile, setCertificationDocFile] = useState<File | null>(null);
  const [hasExistingCertificationDoc, setHasExistingCertificationDoc] = useState(
    defaultValues?.hasCertificationDocument ?? false
  );
  const photosInputRef = useRef<HTMLInputElement>(null);
  const isBlocking = BLOCKING_TYPES.has(type);
  const remainingSlots = MAX_LISTING_PHOTOS - existingPhotos.length;

  const photoPreviews = useMemo(() => photos.map((file) => URL.createObjectURL(file)), [photos]);

  useEffect(() => {
    return () => {
      photoPreviews.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [photoPreviews]);

  // Synchronise le vrai <input type="file"> (celui envoyé dans le FormData à la soumission)
  // avec l'état React, après une suppression via la croix.
  function syncFileInput(files: File[]) {
    const input = photosInputRef.current;
    if (!input) return;
    const dataTransfer = new DataTransfer();
    files.forEach((file) => dataTransfer.items.add(file));
    input.files = dataTransfer.files;
  }

  function handlePhotosChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    if (selected.length > remainingSlots) {
      setPhotoError(
        `Maximum ${MAX_LISTING_PHOTOS} photos au total — sélectionne-en moins (${remainingSlots} restante${remainingSlots > 1 ? 's' : ''}).`
      );
      e.target.value = '';
      setPhotos([]);
      return;
    }
    setPhotoError(null);
    setPhotos(selected);
  }

  function removePhoto(index: number) {
    const next = photos.filter((_, i) => i !== index);
    setPhotos(next);
    syncFileInput(next);
    setPhotoError(null);
  }

  function removeExistingPhoto(id: string) {
    setExistingPhotos((current) => current.filter((photo) => photo.id !== id));
    setPhotoError(null);
  }

  function handleCertificationDocChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (file && file.size > MAX_CERTIFICATION_DOC_SIZE_BYTES) {
      setCertificationDocError('Le justificatif doit faire moins de 5 Mo.');
      e.target.value = '';
      setCertificationDocFile(null);
      return;
    }
    setCertificationDocError(null);
    setCertificationDocFile(file);
  }

  function removeCertificationDoc() {
    setCertificationDocFile(null);
    setHasExistingCertificationDoc(false);
    setCertificationDocError(null);
  }

  if (state.success) {
    return (
      <p
        role="status"
        className="rounded border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-300"
      >
        {successMessage}
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-6">
      {defaultValues?.id && <input type="hidden" name="listingId" value={defaultValues.id} />}
      <div className="space-y-4">
        <h2 className="text-xs font-semibold tracking-wide text-gray-600 uppercase dark:text-gray-400">
          Informations générales
        </h2>
        <div>
          <label htmlFor="title" className="block text-sm font-medium">
            Titre de l&apos;annonce
          </label>
          <input
            id="title"
            name="title"
            type="text"
            required
            defaultValue={defaultValues?.title}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="description" className="block text-sm font-medium">
            Description
          </label>
          <textarea
            id="description"
            name="description"
            rows={4}
            defaultValue={defaultValues?.description ?? ''}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="type" className="block text-sm font-medium">
            Type de logement
          </label>
          <select
            id="type"
            name="type"
            value={type}
            onChange={(e) => setType(e.target.value as typeof type)}
            className={inputClass}
          >
            {LISTING_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-xs font-semibold tracking-wide text-gray-600 uppercase dark:text-gray-400">
          Localisation
        </h2>
        <div>
          <label htmlFor="address" className="block text-sm font-medium">
            Adresse
          </label>
          <input
            id="address"
            name="address"
            type="text"
            defaultValue={defaultValues?.address ?? ''}
            className={inputClass}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="city" className="block text-sm font-medium">
              Ville
            </label>
            <input
              id="city"
              name="city"
              type="text"
              required
              defaultValue={defaultValues?.city}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="country" className="block text-sm font-medium">
              Pays (code ISO)
            </label>
            <input
              id="country"
              name="country"
              type="text"
              required
              placeholder="FR"
              defaultValue={defaultValues?.country}
              className={inputClass}
            />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-xs font-semibold tracking-wide text-gray-600 uppercase dark:text-gray-400">
          Capacité & tarif
        </h2>
        {isBlocking ? (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="minGuests" className="block text-sm font-medium">
                Nombre minimum de festivaliers
              </label>
              <input
                id="minGuests"
                name="minGuests"
                type="number"
                min={2}
                max={10}
                required
                onBlur={clampGuestCountInput}
                defaultValue={defaultValues?.minGuests ?? undefined}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="maxGuests" className="block text-sm font-medium">
                Nombre maximum de festivaliers
              </label>
              <input
                id="maxGuests"
                name="maxGuests"
                type="number"
                min={2}
                max={10}
                required
                onBlur={clampGuestCountInput}
                defaultValue={defaultValues?.maxGuests ?? undefined}
                className={inputClass}
              />
            </div>
            <p className="col-span-2 text-xs text-gray-500 dark:text-gray-400">
              Entre 2 et 10 festivaliers.
            </p>
          </div>
        ) : (
          <div>
            <label htmlFor="spotsTotal" className="block text-sm font-medium">
              Nombre de places disponibles
            </label>
            <input
              id="spotsTotal"
              name="spotsTotal"
              type="number"
              min={2}
              max={10}
              required
              onBlur={clampGuestCountInput}
              defaultValue={defaultValues?.spotsTotal ?? undefined}
              className={inputClass}
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Entre 2 et 10 places.</p>
          </div>
        )}
        <div>
          <label htmlFor="pricePerNight" className="block text-sm font-medium">
            Prix par nuit par voyageur
          </label>
          <input
            id="pricePerNight"
            name="pricePerNight"
            type="number"
            min={0}
            step="0.01"
            required
            defaultValue={defaultValues?.pricePerNight ?? undefined}
            className={inputClass}
          />
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-xs font-semibold tracking-wide text-gray-600 uppercase dark:text-gray-400">
          Équipements & photos
        </h2>
        <fieldset>
          <legend className="text-sm font-medium">Équipements proposés</legend>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {AMENITIES.map((amenity) => (
              <label key={amenity} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="amenities"
                  value={amenity}
                  defaultChecked={defaultValues?.amenities.includes(amenity)}
                  className="h-4 w-4"
                />
                {amenity}
              </label>
            ))}
          </div>
        </fieldset>
        <div>
          <label htmlFor="photos" className="block text-sm font-medium">
            Photos du logement
          </label>
          <input
            ref={photosInputRef}
            id="photos"
            name="photos"
            type="file"
            accept={ALLOWED_PHOTO_TYPES.join(',')}
            multiple
            disabled={remainingSlots <= 0}
            onChange={handlePhotosChange}
            className={inputClass}
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {MAX_LISTING_PHOTOS} photos maximum au total (JPEG, PNG ou WEBP, 5 Mo par photo)
          </p>
          {photoError && (
            <p role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">
              {photoError}
            </p>
          )}
          {(existingPhotos.length > 0 || photoPreviews.length > 0) && (
            <div className="mt-3 grid grid-cols-4 gap-2">
              {existingPhotos.map((photo) => (
                <div key={photo.id} className="group relative">
                  <input type="hidden" name="keepPhotoIds" value={photo.id} />
                  {/* eslint-disable-next-line @next/next/no-img-element -- URLs Supabase Storage, pas de config remotePatterns pour l'instant */}
                  <img src={photo.url} alt="" className="h-20 w-full rounded object-cover" />
                  <button
                    type="button"
                    onClick={() => removeExistingPhoto(photo.id)}
                    aria-label="Supprimer cette photo"
                    className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-gray-900 text-xs leading-none text-white dark:bg-white dark:text-gray-900"
                  >
                    ×
                  </button>
                </div>
              ))}
              {photoPreviews.map((url, index) => (
                <div key={url} className="group relative">
                  {/* eslint-disable-next-line @next/next/no-img-element -- aperçu local (object URL), pas une image distante */}
                  <img
                    src={url}
                    alt={`Aperçu photo ${index + 1}`}
                    className="h-20 w-full rounded object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removePhoto(index)}
                    aria-label={`Supprimer la photo ${index + 1}`}
                    className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-gray-900 text-xs leading-none text-white dark:bg-white dark:text-gray-900"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-xs font-semibold tracking-wide text-gray-600 uppercase dark:text-gray-400">
          Justificatif de domicile
        </h2>
        <div>
          <label htmlFor="certificationDocument" className="block text-sm font-medium">
            Facture EDF, internet…{' '}
            <span className="font-normal text-gray-500 dark:text-gray-400">(optionnel)</span>
          </label>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Le logement peut être créé sans, mais ce document est nécessaire pour obtenir la
            pastille « Hôte certifié ».
          </p>

          {hasExistingCertificationDoc && !certificationDocFile && (
            <div className="mt-2 flex items-center gap-3">
              <span className="rounded-full border border-green-300 bg-green-50 px-2.5 py-0.5 text-xs font-semibold text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-300">
                Justificatif fourni
              </span>
              <button
                type="button"
                onClick={removeCertificationDoc}
                className="text-xs text-red-600 underline dark:text-red-400"
              >
                Supprimer
              </button>
            </div>
          )}
          {!hasExistingCertificationDoc && defaultValues?.hasCertificationDocument && (
            <input type="hidden" name="removeCertificationDocument" value="on" />
          )}

          <input
            id="certificationDocument"
            name="certificationDocument"
            type="file"
            accept={ALLOWED_CERTIFICATION_DOC_TYPES.join(',')}
            onChange={handleCertificationDocChange}
            className={`${inputClass} mt-3`}
          />
          {certificationDocFile && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Fichier sélectionné : {certificationDocFile.name}
            </p>
          )}
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            JPEG, PNG, WEBP ou PDF, 5 Mo maximum.
          </p>
          {certificationDocError && (
            <p role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">
              {certificationDocError}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-xs font-semibold tracking-wide text-gray-600 uppercase dark:text-gray-400">
          Festival associé
        </h2>
        {festivals.length === 0 ? (
          <p className="text-sm text-gray-500">Aucun festival publié pour l&apos;instant.</p>
        ) : (
          <div>
            <label htmlFor="festivalId" className="block text-sm font-medium">
              Festival
            </label>
            <select
              id="festivalId"
              name="festivalId"
              required
              defaultValue={defaultValues?.festivalId ?? ''}
              className={inputClass}
            >
              <option value="" disabled>
                Sélectionner un festival
              </option>
              {festivals.map((festival) => (
                <option key={festival.id} value={festival.id}>
                  {festival.name} — {festival.city}, {festival.country}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Un logement ne peut être associé qu&apos;à un seul festival.
            </p>

            <div className="mt-4">
              <label htmlFor="distanceKm" className="block text-sm font-medium">
                Distance jusqu&apos;au festival (km)
              </label>
              <input
                id="distanceKm"
                name="distanceKm"
                type="number"
                min={0}
                step="0.1"
                defaultValue={defaultValues?.distanceKm ?? undefined}
                className={inputClass}
              />
            </div>

            <div className="mt-4 flex items-center gap-2">
              <input
                id="hasShuttle"
                type="checkbox"
                checked={hasShuttle}
                onChange={(e) => setHasShuttle(e.target.checked)}
                className="h-4 w-4"
              />
              <label htmlFor="hasShuttle" className="text-sm font-medium">
                Je propose un service de navette jusqu&apos;au festival
              </label>
            </div>
            {hasShuttle && (
              <div className="mt-2">
                <input type="hidden" name="hasShuttle" value="on" />
                <label htmlFor="shuttleCost" className="block text-sm font-medium">
                  Coût supplémentaire de la navette (€)
                </label>
                <input
                  id="shuttleCost"
                  name="shuttleCost"
                  type="number"
                  min={0}
                  step="0.01"
                  defaultValue={defaultValues?.shuttleCost ?? 0}
                  className={inputClass}
                />
              </div>
            )}

            <fieldset className="mt-4">
              <legend className="block text-sm font-medium">Disponibilité</legend>
              <div className="mt-2 space-y-2">
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="radio"
                    name="arrivalBuffer"
                    value="0"
                    defaultChecked={(defaultValues?.arrivalBufferDays ?? 1) === 0}
                    className="mt-0.5 h-4 w-4"
                  />
                  Uniquement pendant les dates du festival
                </label>
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="radio"
                    name="arrivalBuffer"
                    value="1"
                    defaultChecked={(defaultValues?.arrivalBufferDays ?? 1) === 1}
                    className="mt-0.5 h-4 w-4"
                  />
                  Les festivaliers peuvent arriver 1 jour avant et repartir 1 jour après
                </label>
              </div>
            </fieldset>
          </div>
        )}
      </div>

      {state.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-gray-900"
      >
        {pending ? 'Envoi…' : submitLabel}
      </button>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        La fiche passera en statut « en attente » jusqu&apos;à validation par un administrateur.
      </p>
    </form>
  );
}
