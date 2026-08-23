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
  const pending = acceptPending || rejectPending;

  return (
    <form className="mt-3 space-y-2">
      <input type="hidden" name="bookingId" value={bookingId} />
      <textarea
        name="message"
        rows={2}
        placeholder="Message pour le festivalier (obligatoire en cas de refus)"
        className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-transparent"
      />
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          formAction={acceptFormAction}
          disabled={pending}
          className="rounded bg-gray-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-gray-900"
        >
          {acceptPending ? '…' : 'Accepter'}
        </button>
        <button
          type="submit"
          formAction={rejectFormAction}
          disabled={pending}
          className="rounded border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-gray-700"
        >
          {rejectPending ? '…' : 'Refuser'}
        </button>
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
    </form>
  );
}
