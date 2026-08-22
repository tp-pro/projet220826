'use client';

import { useActionState } from 'react';

import { shareGuestEmailAction } from '@/lib/bookings/actions';

/**
 * Action volontaire du festivalier, proposée uniquement une fois la demande acceptée par
 * l'hôte — cohérent avec le principe "rien n'est révélé sans un geste explicite du concerné"
 * (voir dbshema.md §5). L'hôte ne voit l'email qu'après ce clic, jamais avant.
 */
export function ShareEmailButton({ bookingId, email }: { bookingId: string; email: string }) {
  const [state, formAction, pending] = useActionState(shareGuestEmailAction, {
    error: null,
    success: false,
  });

  return (
    <div className="mt-2 rounded border border-gray-200 p-3 dark:border-gray-700">
      <p className="text-sm">
        Pour finaliser le contact avec l&apos;hôte, tu peux lui partager ton adresse email (
        <span className="font-medium">{email}</span>).
      </p>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
        Vous disposez de 48h pour faire parvenir votre email à votre hôte. Passez ce délai la mise en relation sera annulée.
      </p>
      <form action={formAction} className="mt-2">
        <input type="hidden" name="bookingId" value={bookingId} />
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-gray-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-gray-900"
        >
          {pending ? '…' : 'Partager mon email avec l’hôte'}
        </button>
      </form>
      {state.error && (
        <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}
    </div>
  );
}
