'use client';

import { useActionState, useRef, useState } from 'react';

import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { deleteAccountAction } from '@/lib/profile/actions';

/**
 * Suppression définitive du compte, avec confirmation dans une boîte de dialogue centrée avant
 * l'envoi. Grisé côté serveur (`blockReason`) tant qu'un logement ou une réservation en
 * attente/en cours existe — revérifié côté serveur dans deleteAccountAction, jamais fait
 * confiance à l'état désactivé du bouton seul.
 */
export function DeleteAccountButton({ blockReason }: { blockReason: string | null }) {
  const [state, formAction, pending] = useActionState(deleteAccountAction, { error: null });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <div>
      <form ref={formRef} action={formAction}>
        <button
          type="button"
          disabled={pending || Boolean(blockReason)}
          onClick={() => setConfirmOpen(true)}
          className="rounded-full border border-danger/40 px-5 py-2.5 text-sm font-semibold text-danger transition-colors hover:bg-danger/10 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? 'Suppression…' : 'Supprimer mon compte'}
        </button>
      </form>
      {blockReason && (
        <p role="status" className="mt-2 text-sm text-muted">
          {blockReason}
        </p>
      )}
      {state.error && !blockReason && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {state.error}
        </p>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title="Supprimer ton compte ?"
        description="Cette action est irréversible : ton profil et toutes tes données seront définitivement supprimés."
        confirmLabel="Supprimer mon compte"
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
