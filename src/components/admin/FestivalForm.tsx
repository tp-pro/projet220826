'use client';

import { useActionState, useEffect, useMemo, useRef, useState } from 'react';

import { type FestivalActionState } from '@/lib/admin/festivals-actions';
import {
  ALLOWED_COVER_TYPES,
  FESTIVAL_CATEGORIES,
  FESTIVAL_CATEGORY_LABELS,
  MAX_COVER_SIZE_BYTES,
} from '@/lib/festivals/constants';

export type FestivalFormDefaultValues = {
  id?: string;
  name?: string;
  slug?: string;
  city?: string;
  country?: string;
  description?: string | null;
  categories?: readonly string[] | null;
  dateStart?: string; // yyyy-mm-dd
  dateEnd?: string; // yyyy-mm-dd
  coverImageUrl?: string | null;
  status?: 'draft' | 'published';
};

export function FestivalForm({
  action,
  defaultValues,
  submitLabel,
}: {
  action: (prevState: FestivalActionState, formData: FormData) => Promise<FestivalActionState>;
  defaultValues?: FestivalFormDefaultValues;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, { error: null });
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [removeExistingCover, setRemoveExistingCover] = useState(false);
  const [coverError, setCoverError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const coverPreview = useMemo(
    () => (coverFile ? URL.createObjectURL(coverFile) : null),
    [coverFile]
  );
  useEffect(() => {
    return () => {
      if (coverPreview) URL.revokeObjectURL(coverPreview);
    };
  }, [coverPreview]);

  function handleCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (file) {
      if (!(ALLOWED_COVER_TYPES as readonly string[]).includes(file.type)) {
        setCoverError('Formats acceptés : JPEG, PNG, WEBP.');
        e.target.value = '';
        setCoverFile(null);
        return;
      }
      if (file.size > MAX_COVER_SIZE_BYTES) {
        setCoverError("L'image doit faire moins de 5 Mo.");
        e.target.value = '';
        setCoverFile(null);
        return;
      }
    }
    setCoverError(null);
    setCoverFile(file);
  }

  function cancelSelection() {
    setCoverFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  const showExistingCover = Boolean(defaultValues?.coverImageUrl) && !removeExistingCover;

  const inputClass =
    'mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-transparent';

  return (
    <form action={formAction} className="space-y-4">
      {defaultValues?.id && <input type="hidden" name="id" value={defaultValues.id} />}

      <div>
        <label htmlFor="name" className="block text-sm font-medium">
          Nom
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          defaultValue={defaultValues?.name}
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="slug" className="block text-sm font-medium">
          Slug (identifiant unique)
        </label>
        <input
          id="slug"
          name="slug"
          type="text"
          required
          placeholder="mon-festival-2026"
          defaultValue={defaultValues?.slug}
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
          placeholder="Présentation du festival, ambiance, programmation…"
          defaultValue={defaultValues?.description ?? ''}
          className={inputClass}
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Optionnel — affichée en haut de la page du festival.
        </p>
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

      <fieldset>
        <legend className="block text-sm font-medium">Catégories</legend>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Un festival peut cumuler plusieurs catégories (ex : Événementiel + Culturel).
        </p>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
          {FESTIVAL_CATEGORIES.map((category) => (
            <label key={category} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="categories"
                value={category}
                defaultChecked={defaultValues?.categories?.includes(category) ?? false}
                className="h-4 w-4 rounded border-gray-300 dark:border-gray-700"
              />
              {FESTIVAL_CATEGORY_LABELS[category]}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="dateStart" className="block text-sm font-medium">
            Date de début
          </label>
          <input
            id="dateStart"
            name="dateStart"
            type="date"
            required
            defaultValue={defaultValues?.dateStart}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="dateEnd" className="block text-sm font-medium">
            Date de fin
          </label>
          <input
            id="dateEnd"
            name="dateEnd"
            type="date"
            required
            defaultValue={defaultValues?.dateEnd}
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label htmlFor="coverImage" className="block text-sm font-medium">
          Image de couverture
        </label>

        {showExistingCover && !coverFile && (
          <div className="mt-2 flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- URL Supabase Storage, pas de config remotePatterns pour l'instant */}
            <img
              src={defaultValues!.coverImageUrl!}
              alt=""
              className="h-20 w-32 rounded object-cover"
            />
            <button
              type="button"
              onClick={() => setRemoveExistingCover(true)}
              className="text-sm text-red-600 underline dark:text-red-400"
            >
              Supprimer l&apos;image
            </button>
          </div>
        )}

        {coverFile && coverPreview && (
          <div className="mt-2 flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- aperçu local (object URL), pas une ressource distante */}
            <img src={coverPreview} alt="" className="h-20 w-32 rounded object-cover" />
            <button
              type="button"
              onClick={cancelSelection}
              className="text-sm text-red-600 underline dark:text-red-400"
            >
              Annuler la sélection
            </button>
          </div>
        )}

        <input
          ref={fileInputRef}
          id="coverImage"
          name="coverImage"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleCoverChange}
          className="mt-2 block w-full text-sm"
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          JPEG, PNG ou WEBP, 5 Mo maximum.
        </p>
        {coverError && (
          <p role="alert" className="mt-1 text-sm text-red-600 dark:text-red-400">
            {coverError}
          </p>
        )}

        {removeExistingCover && <input type="hidden" name="removeCoverImage" value="on" />}
      </div>

      <div>
        <label htmlFor="status" className="block text-sm font-medium">
          Statut
        </label>
        <select
          id="status"
          name="status"
          defaultValue={defaultValues?.status ?? 'draft'}
          className={inputClass}
        >
          <option value="draft">Brouillon (non visible publiquement)</option>
          <option value="published">Publié</option>
        </select>
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
        {pending ? 'Enregistrement…' : submitLabel}
      </button>
    </form>
  );
}
