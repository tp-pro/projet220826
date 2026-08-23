/**
 * Petite pastille rouge signalant une action en attente (demande de mise en relation à
 * traiter, logement en attente de validation…) — à poser sur un `<Link>` (ou tout élément)
 * en position `relative`.
 */
export function PendingDot() {
  return (
    <span
      aria-hidden="true"
      className="absolute -top-1 -right-2.5 h-2 w-2 rounded-full bg-danger"
    />
  );
}
