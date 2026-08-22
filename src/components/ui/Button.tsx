import type { ButtonHTMLAttributes } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-full text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-beacon px-5 py-2.5 text-surface hover:bg-beacon-dark',
  secondary: 'border border-contour px-5 py-2.5 text-ink hover:bg-map',
  ghost: 'px-5 py-2.5 text-ink hover:bg-map',
  danger: 'bg-danger px-5 py-2.5 text-surface hover:opacity-90',
};

/**
 * Génère la className d'un bouton — utilisable sur un <button>, un <Link> ou tout
 * élément cliquable, pour ne pas imposer un composant polymorphe. Voir `Button`
 * ci-dessous pour l'usage <button> direct.
 */
export function buttonClass(variant: ButtonVariant = 'primary', className = '') {
  return `${BASE} ${VARIANTS[variant]} ${className}`.trim();
}

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return <button className={buttonClass(variant, className)} {...props} />;
}
