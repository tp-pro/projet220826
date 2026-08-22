'use client';

import { useActionState } from 'react';

import { requestBookingAction } from '@/lib/bookings/actions';

const windowDateFormatter = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' });

function formatWindowDate(isoDate: string) {
  // new Date('yyyy-mm-dd') est interprété en UTC minuit — évite le décalage d'un jour que
  // donnerait new Date(isoDate) en fuseau local sur certains navigateurs.
  return windowDateFormatter.format(new Date(`${isoDate}T00:00:00Z`));
}

export function RequestBookingForm({
  listingFestivalId,
  minDate,
  maxDate,
  minGuests,
  maxGuests,
}: {
  listingFestivalId: string;
  /** Bornes de la fenêtre de séjour autorisée (dates du festival ± buffer), format yyyy-mm-dd. */
  minDate: string;
  maxDate: string;
  /**
   * Minimum de personnes pour ce logement — `listing.minGuests` (2 à 10, types bloquants) sinon
   * repli sur 2 (aucune réservation pour une seule personne, cohérent avec la borne minimale de
   * `spotsTotal` pour les types "à places", `listings-setup.md` §15/§16).
   */
  minGuests?: number | null;
  /** Capacité du logement, si connue — sinon repli sur une borne large (10). */
  maxGuests?: number | null;
}) {
  const effectiveMinGuests = minGuests ?? 2;
  const [state, formAction, pending] = useActionState(requestBookingAction, {
    error: null,
    success: false,
  });

  if (state.success) {
    return (
      <p
        role="status"
        className="rounded border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-300"
      >
        Demande envoyée — l&apos;hôte va l&apos;examiner. Suis son statut dans{' '}
        <span className="font-medium">Mes demandes de mise en relation</span> depuis ton compte.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="listingFestivalId" value={listingFestivalId} />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="arrivalDate" className="block text-sm font-medium">
            Date d&apos;arrivée
          </label>
          <input
            id="arrivalDate"
            name="arrivalDate"
            type="date"
            required
            defaultValue={minDate}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-transparent"
          />
        </div>
        <div>
          <label htmlFor="departureDate" className="block text-sm font-medium">
            Date de départ
          </label>
          <input
            id="departureDate"
            name="departureDate"
            type="date"
            required
            defaultValue={maxDate}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-transparent"
          />
        </div>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Doit être compris entre le {formatWindowDate(minDate)} et le {formatWindowDate(maxDate)}.
      </p>
      <div>
        <label htmlFor="guestsCount" className="block text-sm font-medium">
          Nombre de personnes
        </label>
        <input
          id="guestsCount"
          name="guestsCount"
          type="number"
          required
          min={effectiveMinGuests}
          max={maxGuests ?? 10}
          defaultValue={effectiveMinGuests}
          className="mt-1 w-24 rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-transparent"
        />
        {effectiveMinGuests > 1 && (
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Minimum {effectiveMinGuests} personnes pour ce logement.
          </p>
        )}
      </div>
      <div>
        <label htmlFor="message" className="block text-sm font-medium">
          Message (optionnel)
        </label>
        <textarea
          id="message"
          name="message"
          rows={3}
          placeholder="Présente-toi en quelques mots à l'hôte…"
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-transparent"
        />
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-gray-900"
      >
        {pending ? 'Envoi…' : 'Demander une mise en relation'}
      </button>
    </form>
  );
}
