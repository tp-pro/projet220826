'use client';

import { useActionState } from 'react';

import { acceptBookingAction, rejectBookingAction } from '@/lib/bookings/actions';

export function BookingRequestActions({ bookingId }: { bookingId: string }) {
  const [acceptState, acceptFormAction, acceptPending] = useActionState(acceptBookingAction, {
    error: null,
    success: false,
  });
  const [rejectState, rejectFormAction, rejectPending] = useActionState(rejectBookingAction, {
    error: null,
    success: false,
  });

  return (
    <div className="mt-3 space-y-2">
      <div className="flex flex-wrap items-start gap-2">
        <form action={acceptFormAction} className="flex flex-1 flex-wrap items-center gap-2">
          <input type="hidden" name="bookingId" value={bookingId} />
          <input
            type="text"
            name="message"
            placeholder="Message pour le festivalier (optionnel)"
            className="min-w-48 flex-1 rounded border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-transparent"
          />
          <button
            type="submit"
            disabled={acceptPending}
            className="rounded bg-gray-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-gray-900"
          >
            {acceptPending ? '…' : 'Accepter'}
          </button>
        </form>
        <form action={rejectFormAction} className="flex flex-1 flex-wrap items-center gap-2">
          <input type="hidden" name="bookingId" value={bookingId} />
          <input
            type="text"
            name="reason"
            required
            placeholder="Motif du refus"
            className="min-w-48 flex-1 rounded border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-transparent"
          />
          <button
            type="submit"
            disabled={rejectPending}
            className="rounded border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-gray-700"
          >
            {rejectPending ? '…' : 'Refuser'}
          </button>
        </form>
      </div>
      {acceptState.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {acceptState.error}
        </p>
      )}
      {rejectState.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {rejectState.error}
        </p>
      )}
    </div>
  );
}
