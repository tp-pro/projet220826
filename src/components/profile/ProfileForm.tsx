'use client';

import { useActionState, useEffect, useMemo, useRef, useState } from 'react';

import { updateProfileAction } from '@/lib/profile/actions';
import { ALLOWED_AVATAR_TYPES, MAX_AVATAR_SIZE_BYTES } from '@/lib/profile/constants';

function toDateInputValue(date: Date | null) {
  if (!date) return '';
  return date.toISOString().slice(0, 10);
}

export function ProfileForm({
  displayName,
  defaultCity,
  defaultBirthDate,
  defaultAvatarUrl,
}: {
  /** Nom (ou email à défaut) affiché à côté de la photo — usage purement visuel ici. */
  displayName: string;
  defaultCity: string | null;
  defaultBirthDate: Date | null;
  defaultAvatarUrl: string | null;
}) {
  const [state, formAction, pending] = useActionState(updateProfileAction, {
    error: null,
    success: false,
  });
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [removeExistingAvatar, setRemoveExistingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const avatarPreview = useMemo(
    () => (avatarFile ? URL.createObjectURL(avatarFile) : null),
    [avatarFile]
  );
  useEffect(() => {
    return () => {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    };
  }, [avatarPreview]);

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (file) {
      if (!(ALLOWED_AVATAR_TYPES as readonly string[]).includes(file.type)) {
        setAvatarError('Formats acceptés : JPEG, PNG, WEBP.');
        e.target.value = '';
        setAvatarFile(null);
        return;
      }
      if (file.size > MAX_AVATAR_SIZE_BYTES) {
        setAvatarError('La photo doit faire moins de 5 Mo.');
        e.target.value = '';
        setAvatarFile(null);
        return;
      }
    }
    setAvatarError(null);
    setRemoveExistingAvatar(false);
    setAvatarFile(file);
  }

  function removeAvatar() {
    setAvatarFile(null);
    if (avatarInputRef.current) avatarInputRef.current.value = '';
    setRemoveExistingAvatar(true);
  }

  const showExistingAvatar = Boolean(defaultAvatarUrl) && !removeExistingAvatar;
  const avatarSrc = avatarPreview ?? (showExistingAvatar ? defaultAvatarUrl : null);
  const hasAvatarToRemove = Boolean(avatarFile) || showExistingAvatar;

  const inputClass =
    'mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-transparent';

  return (
    <form action={formAction} className="space-y-6">
      <div>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => avatarInputRef.current?.click()}
            aria-label="Changer la photo de profil"
            className="group relative h-16 w-16 shrink-0 overflow-hidden rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900 dark:focus-visible:outline-white"
          >
            {avatarSrc ? (
              // eslint-disable-next-line @next/next/no-img-element -- URL Supabase Storage ou aperçu local (object URL)
              <img src={avatarSrc} alt="" className="h-full w-full object-cover" />
            ) : (
              <div
                aria-hidden="true"
                className="flex h-full w-full items-center justify-center bg-gray-200 text-lg font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400"
              >
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}
            <span className="absolute inset-0 flex items-center justify-center bg-black/0 text-transparent transition-colors group-hover:bg-black/40 group-hover:text-white">
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="h-5 w-5"
              >
                <path d="M4 8a2 2 0 0 1 2-2h1.2l.9-1.4A2 2 0 0 1 9.8 3.6h4.4a2 2 0 0 1 1.7 1L16.8 6H18a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8Z" />
                <circle cx="12" cy="13" r="3.2" />
              </svg>
            </span>
          </button>
          <div>
            <p className="text-sm font-medium">{displayName}</p>
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              className="mt-0.5 text-xs text-gray-500 underline dark:text-gray-400"
            >
              Changer la photo
            </button>
            {hasAvatarToRemove && (
              <>
                {' · '}
                <button
                  type="button"
                  onClick={removeAvatar}
                  className="mt-0.5 text-xs text-red-600 underline dark:text-red-400"
                >
                  Supprimer
                </button>
              </>
            )}
          </div>
        </div>
        <input
          ref={avatarInputRef}
          id="avatar"
          name="avatar"
          type="file"
          accept={ALLOWED_AVATAR_TYPES.join(',')}
          onChange={handleAvatarChange}
          className="sr-only"
        />
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          JPEG, PNG ou WEBP, 5 Mo maximum.
        </p>
        {avatarError && (
          <p role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">
            {avatarError}
          </p>
        )}
        {removeExistingAvatar && <input type="hidden" name="removeAvatar" value="on" />}
      </div>

      <div>
        <label htmlFor="city" className="block text-sm font-medium">
          Ville
        </label>
        <input
          id="city"
          name="city"
          type="text"
          defaultValue={defaultCity ?? ''}
          placeholder="Ville où tu habites"
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor="birthDate" className="block text-sm font-medium">
          Date de naissance
        </label>
        <input
          id="birthDate"
          name="birthDate"
          type="date"
          defaultValue={toDateInputValue(defaultBirthDate)}
          className={inputClass}
        />
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Visible par un hôte uniquement lorsque tu envoies une demande de mise en relation (ville +
        âge, jamais la date exacte).
      </p>
      {state.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="text-sm text-green-700 dark:text-green-400">
          Profil mis à jour.
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded border border-gray-300 px-4 py-2 text-sm font-medium disabled:opacity-50 dark:border-gray-700"
      >
        {pending ? 'Enregistrement…' : 'Enregistrer'}
      </button>
    </form>
  );
}
