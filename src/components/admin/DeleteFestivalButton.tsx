'use client';

import { useActionState } from 'react';

import { deleteFestivalAction } from '@/lib/admin/festivals-actions';

/**
 * Suppression définitive d'un festival, avec confirmation navigateur avant l'envoi — la
 * suppression cascade vers les associations logement↔festival, demandes de mise en relation
 * et avis liés (voir deleteFestivalAction), jamais vers les logements eux-mêmes.
 */
export function DeleteFestivalButton({
  festivalId,
  festivalName,
}: {
  festivalId: string;
  festivalName: string;
}) {
  const [state, formAction, pending] = useActionState(deleteFestivalAction, { error: null });

  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={festivalId} />
      <button
        type="submit"
        disabled={pending}
        onClick={(e) => {
          const confirmed = window.confirm(
            `Supprimer définitivement « ${festivalName} » ? Les associations avec des logements, les demandes de mise en relation et les avis liés à ce festival seront aussi supprimés. Cette action est irréversible.`
          );
          if (!confirmed) {
            e.preventDefault();
          }
        }}
        className="rounded border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 disabled:opacity-50 dark:border-red-900 dark:text-red-400"
      >
        {pending ? 'Suppression…' : 'Supprimer ce festival'}
      </button>
      {state.error && (
        <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}
    </form>
  );
}
