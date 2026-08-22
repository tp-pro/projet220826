'use client';

import { useEffect, useRef } from 'react';

/**
 * Boîte de confirmation centrée, en remplacement de `window.confirm()` — s'appuie sur
 * `<dialog>` natif pour le centrage, le focus trap et la fermeture au clavier (Échap),
 * habillée avec les tokens de la direction "Balise" (voir globals.css).
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  destructive = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        // Échap déclenche `cancel` puis fermerait immédiatement le <dialog> — on l'empêche
        // pour laisser le parent piloter `open` (source de vérité unique).
        e.preventDefault();
        onCancel();
      }}
      onClick={(e) => {
        // Un clic dont la cible est le <dialog> lui-même (pas un enfant) vient du backdrop.
        if (e.target === ref.current) onCancel();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-lg border border-border bg-surface p-6 text-ink shadow-xl backdrop:bg-ink/50"
    >
      <h2 className="text-lg font-semibold">{title}</h2>
      {description && <p className="mt-2 text-sm text-muted">{description}</p>}
      <div className="mt-6 flex justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border border-contour px-5 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-map"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className={`rounded-full px-5 py-2.5 text-sm font-semibold text-surface transition-colors ${
            destructive ? 'bg-danger hover:opacity-90' : 'bg-beacon hover:bg-beacon-dark'
          }`}
        >
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
