import type { ReactNode } from 'react';

export type BadgeVariant = 'type' | 'shuttle' | 'success' | 'danger' | 'pending' | 'muted';

const VARIANTS: Record<BadgeVariant, string> = {
  type: 'bg-contour text-paper',
  shuttle: 'border border-blaze/40 bg-blaze/15 text-blaze',
  success: 'border border-success/40 bg-success/15 text-success',
  danger: 'border border-danger/40 bg-danger/15 text-danger',
  pending: 'border border-beacon/40 bg-beacon/15 text-beacon',
  muted: 'border border-border text-muted',
};

export function Badge({
  variant = 'muted',
  children,
}: {
  variant?: BadgeVariant;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${VARIANTS[variant]}`}
    >
      {children}
    </span>
  );
}
