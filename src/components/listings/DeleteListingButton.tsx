'use client';

import { useActionState, useRef, useState } from 'react';

import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { deleteListingAction } from '@/lib/listings/actions';

/**
 * Suppression définitive du logement de l'hôte, avec confirmation dans une boîte de dialogue
 * centrée (ConfirmDialog) avant l'envoi. Grisé côté serveur (`hasActiveBooking`) tant qu'une
 * réservation acceptée existe — revérifié côté serveur dans deleteListingAction, jamais fait
 * confiance à l'état désactivé du bouton seul.
 */
export function DeleteListingButton({
  listingId,
  listingTitle,
  hasActiveBooking,
}: {
  listingId: string;
  listingTitle: string;
  hasActiveBooking: boolean;
}) {
  const [state, formAction, pending] = useActionState(deleteListingAction, { error: null });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <div>
      <form ref={formRef} action={formAction}>
        <input type="hidden" name="listingId" value={listingId} />
        <button
          type="button"
          disabled={pending || hasActiveBooking}
          onClick={() => setConfirmOpen(true)}
          className="rounded-full border border-danger/40 px-5 py-2.5 text-sm font-semibold text-danger transition-colors hover:bg-danger/10 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? 'Suppression…' : 'Supprimer mon logement'}
        </button>
      </form>
      {hasActiveBooking && (
        <p role="status" className="mt-2 text-sm text-muted">
          Tu as une réservation en cours, tu ne peux pas supprimer ton logement.
        </p>
      )}
      {state.error && !hasActiveBooking && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {state.error}
        </p>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title="Supprimer ce logement ?"
        description={`« ${listingTitle} » sera supprimé définitivement. Cette action est irréversible.`}
        confirmLabel="Supprimer"
        destructive
        onConfirm={() => {
          setConfirmOpen(false);
          formRef.current?.requestSubmit();
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
