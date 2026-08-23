'use server';

import { and, eq, inArray, lte, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

import { db } from '@/db/client';
import {
  BLOCKING_LISTING_TYPES,
  bookings,
  festivals,
  listingFestivals,
  listings,
} from '@/db/schema';
import { EMAIL_SHARE_WINDOW_HOURS, isEmailShareWindowOpen } from '@/lib/bookings/availability';
import { createClient } from '@/lib/supabase/server';

/**
 * Revalide toutes les pages où le statut d'une demande est affiché — la fiche
 * logement et la grille du festival (badges "en attente"/"déjà réservé" pour les
 * festivaliers), en plus des inbox hôte/festivalier. Sans ça, une action côté
 * hôte (accepter/refuser) ou côté festivalier (demander) laisse ces pages avec
 * des données obsolètes tant qu'elles ne sont pas revisitées après expiration
 * du cache client Next.js.
 */
function revalidateBookingViews({
  listingId,
  festivalSlug,
  affectsAvailability,
}: {
  listingId: string;
  festivalSlug: string | null;
  affectsAvailability: boolean;
}) {
  revalidatePath('/logements/demandes');
  revalidatePath('/mes-demandes');
  revalidatePath(`/logements/${listingId}`);
  if (festivalSlug) {
    revalidatePath(`/festivals/${festivalSlug}`);
  }
  // Le compteur "logements disponibles" de l'accueil ne dépend que des bookings
  // `accepted` (voir lib/bookings/availability.ts) — un pending ou un rejected ne
  // change jamais la disponibilité, inutile de revalider l'accueil pour ces cas-là.
  if (affectsAvailability) {
    revalidatePath('/');
  }
}

const EMAIL_SHARE_CANCELLATION_REASON = `Email non partagé dans les ${EMAIL_SHARE_WINDOW_HOURS}h suivant l'acceptation — mise en relation annulée automatiquement.`;

/**
 * Annule automatiquement toute demande `accepted` dont le festivalier n'a pas partagé l'email
 * dans le délai de 48h (booking-requests-setup.md §16/§18) — pas de tâche planifiée dans ce
 * projet, donc balayage "paresseux" appelé au chargement des pages où le statut compte
 * réellement (`/mes-demandes`, `/logements/demandes`, fiche logement publique) plutôt qu'un vrai
 * cron. Idempotent : ne fait rien si aucune demande n'est concernée. Le motif est réutilisé dans
 * `rejection_reason` (déjà affiché pour `rejected`, étendu à `cancelled` côté festivalier) plutôt
 * que d'ajouter une colonne dédiée pour un texte fixe.
 *
 * ⚠️ Contrairement aux autres actions de ce fichier, cette fonction est appelée depuis le rendu
 * de Server Components (pas depuis un `<form action>`) — `revalidatePath` ne peut être appelé
 * que depuis une Server Action ou un Route Handler, jamais pendant un rendu, sous peine d'erreur
 * serveur. Pas de `revalidateBookingViews()` ici : la page qui vient d'appeler cette fonction
 * relit de toute façon des données fraîches juste après (même requête), et les pages qui exigent
 * une session (`/mes-demandes`, `/logements/demandes`, `/logements/[id]`) sont déjà rendues
 * dynamiquement à chaque requête (lecture de cookies via `supabase.auth.getUser()`) — seule la
 * page d'accueil publique pourrait rester temporairement obsolète, jusqu'à la prochaine action
 * (accepter/refuser/partager) qui revalide `/` normalement.
 */
export async function expireOverdueAcceptedBookings(): Promise<void> {
  const cutoff = new Date(Date.now() - EMAIL_SHARE_WINDOW_HOURS * 60 * 60 * 1000);

  const overdue = await db
    .select({ bookingId: bookings.id })
    .from(bookings)
    .where(
      and(
        eq(bookings.status, 'accepted'),
        eq(bookings.guestEmailShared, false),
        lte(bookings.respondedAt, cutoff)
      )
    );

  if (overdue.length === 0) return;

  await db
    .update(bookings)
    .set({ status: 'cancelled', rejectionReason: EMAIL_SHARE_CANCELLATION_REASON })
    .where(
      inArray(
        bookings.id,
        overdue.map((o) => o.bookingId)
      )
    );
}

export type BookingActionState = {
  error: string | null;
  success: boolean;
};

export async function requestBookingAction(
  _prevState: BookingActionState,
  formData: FormData
): Promise<BookingActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Tu dois être connecté pour envoyer une demande.', success: false };
  }

  const listingFestivalId = String(formData.get('listingFestivalId') ?? '').trim();
  if (!listingFestivalId) {
    return { error: 'Logement introuvable.', success: false };
  }

  const message = String(formData.get('message') ?? '').trim();
  const arrivalDateRaw = String(formData.get('arrivalDate') ?? '').trim();
  const departureDateRaw = String(formData.get('departureDate') ?? '').trim();
  const guestsCountRaw = String(formData.get('guestsCount') ?? '').trim();

  if (!arrivalDateRaw || !departureDateRaw) {
    return { error: "Merci d'indiquer ta date d'arrivée et ta date de départ.", success: false };
  }
  const arrivalDate = new Date(arrivalDateRaw);
  const departureDate = new Date(departureDateRaw);
  if (Number.isNaN(arrivalDate.getTime()) || Number.isNaN(departureDate.getTime())) {
    return { error: 'Dates invalides.', success: false };
  }
  if (arrivalDate > departureDate) {
    return {
      error: "La date d'arrivée doit être avant (ou égale à) la date de départ.",
      success: false,
    };
  }

  const guestsCount = Number(guestsCountRaw);
  if (!Number.isInteger(guestsCount) || guestsCount < 1) {
    return { error: 'Le nombre de personnes doit être un entier positif.', success: false };
  }
  // Bornes précises (dépendantes du logement) revalidées plus bas, une fois `row` chargé.

  const [row] = await db
    .select({
      listing: listings,
      festival: festivals,
      arrivalBufferBefore: listingFestivals.arrivalBufferBefore,
      arrivalBufferAfter: listingFestivals.arrivalBufferAfter,
    })
    .from(listingFestivals)
    .innerJoin(listings, eq(listings.id, listingFestivals.listingId))
    .leftJoin(festivals, eq(festivals.id, listingFestivals.festivalId))
    .where(eq(listingFestivals.id, listingFestivalId))
    .limit(1);

  if (!row) {
    return { error: 'Logement introuvable.', success: false };
  }
  if (row.listing.hostId === user.id) {
    return { error: 'Tu ne peux pas envoyer une demande sur ton propre logement.', success: false };
  }

  // Nombre de personnes borné par la capacité réelle du logement — `minGuests` (2 à 10, types
  // bloquants uniquement, voir listings-setup.md §15) sinon repli sur 2 (aucune réservation
  // pour une seule personne, cohérent avec la borne minimale de `spotsTotal`, §16) ; `maxGuests`
  // ou `spotsTotal` en plafond. Jamais fait confiance aux attributs min/max HTML seuls.
  const effectiveMinGuests = row.listing.minGuests ?? 2;
  const effectiveMaxGuests = row.listing.maxGuests ?? row.listing.spotsTotal ?? 10;
  if (guestsCount < effectiveMinGuests || guestsCount > effectiveMaxGuests) {
    return {
      error: `Le nombre de personnes doit être compris entre ${effectiveMinGuests} et ${effectiveMaxGuests} pour ce logement.`,
      success: false,
    };
  }

  // Fenêtre de séjour autorisée = dates du festival ± buffer (voir dbshema.md §3.6/§3.5) —
  // un min/max HTML sur le formulaire n'est qu'une suggestion au navigateur, revalidé ici
  // contre une requête forgée directement.
  if (row.festival) {
    const minDate = new Date(row.festival.dateStart);
    minDate.setDate(minDate.getDate() - row.arrivalBufferBefore);
    const maxDate = new Date(row.festival.dateEnd);
    maxDate.setDate(maxDate.getDate() + row.arrivalBufferAfter);

    if (
      arrivalDate < minDate ||
      arrivalDate > maxDate ||
      departureDate < minDate ||
      departureDate > maxDate
    ) {
      return {
        error: `Les dates doivent être comprises entre le ${minDate.toLocaleDateString('fr-FR')} et le ${maxDate.toLocaleDateString('fr-FR')}.`,
        success: false,
      };
    }
  }

  const [existing] = await db
    .select({ id: bookings.id, status: bookings.status })
    .from(bookings)
    .where(and(eq(bookings.listingFestivalId, listingFestivalId), eq(bookings.guestId, user.id)))
    .limit(1);

  if (existing && (existing.status === 'pending' || existing.status === 'accepted')) {
    return { error: 'Tu as déjà une demande en cours pour ce logement.', success: false };
  }

  await db.insert(bookings).values({
    listingFestivalId,
    guestId: user.id,
    message: message || null,
    arrivalDate,
    departureDate,
    guestsCount,
    status: 'pending',
  });

  revalidateBookingViews({
    listingId: row.listing.id,
    festivalSlug: row.festival?.slug ?? null,
    affectsAvailability: false,
  });

  return { error: null, success: true };
}

export async function acceptBookingAction(
  _prevState: BookingActionState,
  formData: FormData
): Promise<BookingActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Non connecté.', success: false };

  const bookingId = String(formData.get('bookingId') ?? '');
  if (!bookingId) return { error: 'Demande introuvable.', success: false };

  // Message optionnel de l'hôte à l'acceptation (contact, consignes d'arrivée...) — consultable
  // par le festivalier sur /mes-demandes, contrairement au motif de refus qui reste requis.
  const acceptanceMessage = String(formData.get('message') ?? '').trim();

  const [row] = await db
    .select({
      booking: bookings,
      listing: listings,
      listingFestivalId: listingFestivals.id,
      spotsAvailable: listingFestivals.spotsAvailable,
      festivalSlug: festivals.slug,
    })
    .from(bookings)
    .innerJoin(listingFestivals, eq(listingFestivals.id, bookings.listingFestivalId))
    .innerJoin(listings, eq(listings.id, listingFestivals.listingId))
    .leftJoin(festivals, eq(festivals.id, listingFestivals.festivalId))
    .where(eq(bookings.id, bookingId))
    .limit(1);

  if (!row || row.listing.hostId !== user.id) {
    return { error: 'Demande introuvable.', success: false };
  }

  const isBlocking = (BLOCKING_LISTING_TYPES as readonly string[]).includes(row.listing.type);

  if (isBlocking) {
    const [conflict] = await db
      .select({ id: bookings.id })
      .from(bookings)
      .where(
        and(eq(bookings.listingFestivalId, row.listingFestivalId), eq(bookings.status, 'accepted'))
      )
      .limit(1);
    if (conflict) {
      return { error: 'Ce logement est déjà réservé pour ce festival.', success: false };
    }
  } else {
    const capacity = row.spotsAvailable ?? row.listing.spotsTotal ?? 0;
    const [{ total }] = await db
      .select({ total: sql<number>`coalesce(sum(${bookings.spotsBooked}), 0)` })
      .from(bookings)
      .where(
        and(eq(bookings.listingFestivalId, row.listingFestivalId), eq(bookings.status, 'accepted'))
      );
    if (Number(total) + row.booking.spotsBooked > capacity) {
      return {
        error: 'Plus assez de places disponibles pour accepter cette demande.',
        success: false,
      };
    }
  }

  await db
    .update(bookings)
    .set({
      status: 'accepted',
      respondedAt: new Date(),
      rejectionReason: null,
      acceptanceMessage: acceptanceMessage || null,
    })
    .where(eq(bookings.id, bookingId));

  revalidateBookingViews({
    listingId: row.listing.id,
    festivalSlug: row.festivalSlug,
    affectsAvailability: true,
  });

  return { error: null, success: true };
}

export async function rejectBookingAction(
  _prevState: BookingActionState,
  formData: FormData
): Promise<BookingActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Non connecté.', success: false };

  const bookingId = String(formData.get('bookingId') ?? '');
  // Même champ texte que l'acceptation (voir BookingRequestActions) — requis ici uniquement,
  // écrit comme motif de refus.
  const reason = String(formData.get('message') ?? '').trim();
  if (!bookingId || !reason)
    return { error: 'Merci de renseigner un message pour le refus.', success: false };

  const [row] = await db
    .select({ listing: listings, festivalSlug: festivals.slug })
    .from(bookings)
    .innerJoin(listingFestivals, eq(listingFestivals.id, bookings.listingFestivalId))
    .innerJoin(listings, eq(listings.id, listingFestivals.listingId))
    .leftJoin(festivals, eq(festivals.id, listingFestivals.festivalId))
    .where(eq(bookings.id, bookingId))
    .limit(1);

  if (!row || row.listing.hostId !== user.id) {
    return { error: 'Demande introuvable.', success: false };
  }

  await db
    .update(bookings)
    .set({ status: 'rejected', respondedAt: new Date(), rejectionReason: reason })
    .where(eq(bookings.id, bookingId));

  revalidateBookingViews({
    listingId: row.listing.id,
    festivalSlug: row.festivalSlug,
    affectsAvailability: false,
  });

  return { error: null, success: true };
}

/**
 * Partage l'email du festivalier avec l'hôte — action volontaire du festivalier, jamais
 * automatique : cohérent avec le principe déjà en place (dbshema.md §5, "Confidentialité
 * hôte/festivalier") qu'aucune coordonnée n'est révélée sans un geste explicite du concerné.
 * Seule la demande `accepted` du festivalier lui-même peut être partagée ainsi (vérifié via
 * `booking.guestId === user.id`, pas juste `requireAdmin`/`hostId` comme les actions hôte).
 */
export async function shareGuestEmailAction(
  _prevState: BookingActionState,
  formData: FormData
): Promise<BookingActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Non connecté.', success: false };

  const bookingId = String(formData.get('bookingId') ?? '');
  if (!bookingId) return { error: 'Demande introuvable.', success: false };

  const [row] = await db
    .select({ booking: bookings, listing: listings, festivalSlug: festivals.slug })
    .from(bookings)
    .innerJoin(listingFestivals, eq(listingFestivals.id, bookings.listingFestivalId))
    .innerJoin(listings, eq(listings.id, listingFestivals.listingId))
    .leftJoin(festivals, eq(festivals.id, listingFestivals.festivalId))
    .where(eq(bookings.id, bookingId))
    .limit(1);

  if (!row || row.booking.guestId !== user.id) {
    return { error: 'Demande introuvable.', success: false };
  }
  if (row.booking.status !== 'accepted') {
    return {
      error: "Ta demande doit être acceptée par l'hôte avant de pouvoir partager ton email.",
      success: false,
    };
  }
  // Fenêtre de 48h après acceptation — jamais fait confiance à l'horloge du client, revalidée
  // ici indépendamment de ce qu'affiche la page (booking-requests-setup.md §16).
  if (!isEmailShareWindowOpen(row.booking.respondedAt)) {
    return {
      error: `Le délai de ${EMAIL_SHARE_WINDOW_HOURS}h pour partager ton email est dépassé.`,
      success: false,
    };
  }

  await db.update(bookings).set({ guestEmailShared: true }).where(eq(bookings.id, bookingId));

  revalidateBookingViews({
    listingId: row.listing.id,
    festivalSlug: row.festivalSlug,
    affectsAvailability: false,
  });

  return { error: null, success: true };
}
