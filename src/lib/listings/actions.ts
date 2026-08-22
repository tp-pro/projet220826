'use server';

import { and, eq, inArray } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import {
  BLOCKING_LISTING_TYPES,
  bookings,
  listingFestivals,
  listingPhotos,
  listingTypeEnum,
  listings,
} from '@/db/schema';
import { db } from '@/db/client';
import {
  ALLOWED_CERTIFICATION_DOC_TYPES,
  ALLOWED_PHOTO_TYPES,
  MAX_CERTIFICATION_DOC_SIZE_BYTES,
  MAX_LISTING_PHOTOS,
  MAX_PHOTO_SIZE_BYTES,
} from '@/lib/listings/constants';
import {
  deleteCertificationDocument,
  uploadCertificationDocument,
  uploadListingPhoto,
} from '@/lib/listings/storage';
import { createClient } from '@/lib/supabase/server';

export type CreateListingActionState = {
  error: string | null;
  success: boolean;
};

function parsePositiveNumber(raw: string): number | null {
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

type ParsedListingForm =
  | { success: false; error: string }
  | {
      success: true;
      fields: {
        title: string;
        description: string | null;
        address: string | null;
        city: string;
        country: string;
        type: (typeof listingTypeEnum.enumValues)[number];
        minGuests: number | null;
        maxGuests: number | null;
        spotsTotal: number | null;
        pricePerNight: number;
        amenities: string[] | null;
      };
      photoFiles: File[];
      keepPhotoIds: string[];
      certificationDocumentFile: File | null;
      removeCertificationDocument: boolean;
      festivalId: string;
      distanceKm: number | null;
      hasShuttle: boolean;
      shuttleCost: number;
      arrivalBufferDays: number;
    };

/** Validation partagée entre création et modification — mêmes règles pour les deux. */
function parseListingForm(formData: FormData): ParsedListingForm {
  const title = String(formData.get('title') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  const address = String(formData.get('address') ?? '').trim();
  const city = String(formData.get('city') ?? '').trim();
  const country = String(formData.get('country') ?? '').trim();
  const type = String(formData.get('type') ?? '');
  const minGuestsRaw = String(formData.get('minGuests') ?? '').trim();
  const maxGuestsRaw = String(formData.get('maxGuests') ?? '').trim();
  const spotsTotalRaw = String(formData.get('spotsTotal') ?? '').trim();
  const pricePerNightRaw = String(formData.get('pricePerNight') ?? '').trim();

  if (!title || !city || !country) {
    return { success: false, error: 'Merci de remplir tous les champs obligatoires.' };
  }

  if (!(listingTypeEnum.enumValues as readonly string[]).includes(type)) {
    return { success: false, error: 'Type de logement invalide.' };
  }
  const listingType = type as (typeof listingTypeEnum.enumValues)[number];

  const pricePerNight = parsePositiveNumber(pricePerNightRaw);
  if (pricePerNight === null || pricePerNight <= 0) {
    return { success: false, error: 'Le prix doit être un nombre positif.' };
  }

  const isBlocking = (BLOCKING_LISTING_TYPES as readonly string[]).includes(listingType);
  const minGuests = parsePositiveNumber(minGuestsRaw);
  const maxGuests = parsePositiveNumber(maxGuestsRaw);
  const spotsTotal = parsePositiveNumber(spotsTotalRaw);

  if (isBlocking) {
    if (!minGuests || !maxGuests) {
      return {
        success: false,
        error: "Merci d'indiquer le nombre minimum et maximum de festivaliers.",
      };
    }
    // Bornes fixes (2 à 10) — un `min`/`max` HTML n'est qu'une suggestion au navigateur,
    // jamais fait confiance sans revalidation serveur.
    if (minGuests < 2 || minGuests > 10 || maxGuests < 2 || maxGuests > 10) {
      return {
        success: false,
        error: 'Le nombre de festivaliers doit être compris entre 2 et 10.',
      };
    }
    if (minGuests > maxGuests) {
      return {
        success: false,
        error: 'Le minimum de festivaliers ne peut pas dépasser le maximum.',
      };
    }
  }
  if (!isBlocking) {
    if (!spotsTotal) {
      return { success: false, error: "Merci d'indiquer le nombre de places disponibles." };
    }
    // Bornes fixes (2 à 10), même principe que minGuests/maxGuests ci-dessus — jamais fait
    // confiance aux attributs min/max HTML seuls.
    if (spotsTotal < 2 || spotsTotal > 10) {
      return {
        success: false,
        error: 'Le nombre de places disponibles doit être compris entre 2 et 10.',
      };
    }
  }

  const selectedAmenities = formData.getAll('amenities').map(String).filter(Boolean);
  const amenities = selectedAmenities.length > 0 ? selectedAmenities : null;

  const keepPhotoIds = formData.getAll('keepPhotoIds').map(String).filter(Boolean);
  const photoFiles = formData
    .getAll('photos')
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);

  if (keepPhotoIds.length + photoFiles.length > MAX_LISTING_PHOTOS) {
    return { success: false, error: `${MAX_LISTING_PHOTOS} photos maximum au total.` };
  }
  for (const file of photoFiles) {
    if (!(ALLOWED_PHOTO_TYPES as readonly string[]).includes(file.type)) {
      return { success: false, error: 'Formats acceptés : JPEG, PNG, WEBP.' };
    }
    if (file.size > MAX_PHOTO_SIZE_BYTES) {
      return { success: false, error: 'Chaque photo doit faire moins de 5 Mo.' };
    }
  }

  const certificationDocumentEntry = formData.get('certificationDocument');
  const certificationDocumentFile =
    certificationDocumentEntry instanceof File && certificationDocumentEntry.size > 0
      ? certificationDocumentEntry
      : null;
  const removeCertificationDocument = formData.get('removeCertificationDocument') === 'on';
  if (certificationDocumentFile) {
    if (
      !(ALLOWED_CERTIFICATION_DOC_TYPES as readonly string[]).includes(
        certificationDocumentFile.type
      )
    ) {
      return { success: false, error: 'Justificatif : formats acceptés — JPEG, PNG, WEBP ou PDF.' };
    }
    if (certificationDocumentFile.size > MAX_CERTIFICATION_DOC_SIZE_BYTES) {
      return { success: false, error: 'Le justificatif doit faire moins de 5 Mo.' };
    }
  }

  const festivalId = String(formData.get('festivalId') ?? '').trim();
  if (!festivalId) {
    return { success: false, error: 'Merci de sélectionner un festival.' };
  }

  const distanceKm = parsePositiveNumber(String(formData.get('distanceKm') ?? '').trim());
  const hasShuttle = formData.get('hasShuttle') === 'on';
  // Coût forcé à 0 si la navette n'est pas proposée, quelle que soit la valeur du champ.
  const shuttleCost = hasShuttle
    ? (parsePositiveNumber(String(formData.get('shuttleCost') ?? '').trim()) ?? 0)
    : 0;
  // Allow-list stricte : seules '0' et '1' sont des valeurs valides, tout le reste (y compris
  // absent) retombe sur 1 — jamais fait confiance à une valeur radio transmise par le client.
  const arrivalBufferDays = String(formData.get('arrivalBuffer') ?? '') === '0' ? 0 : 1;

  return {
    success: true,
    fields: {
      title,
      description: description || null,
      address: address || null,
      city,
      country,
      type: listingType,
      minGuests: isBlocking ? minGuests : null,
      maxGuests: isBlocking ? maxGuests : null,
      spotsTotal: isBlocking ? null : spotsTotal,
      pricePerNight,
      amenities,
    },
    photoFiles,
    keepPhotoIds,
    certificationDocumentFile,
    removeCertificationDocument,
    festivalId,
    distanceKm,
    hasShuttle,
    shuttleCost,
    arrivalBufferDays,
  };
}

export async function createListingAction(
  _prevState: CreateListingActionState,
  formData: FormData
): Promise<CreateListingActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Tu dois être connecté pour publier un logement.', success: false };
  }

  const parsed = parseListingForm(formData);
  if (!parsed.success) return { error: parsed.error, success: false };
  const {
    fields,
    photoFiles,
    certificationDocumentFile,
    festivalId,
    distanceKm,
    hasShuttle,
    shuttleCost,
    arrivalBufferDays,
  } = parsed;

  let listingId: string;
  try {
    const [inserted] = await db
      .insert(listings)
      .values({
        hostId: user.id,
        ...fields,
        pricePerNight: fields.pricePerNight.toFixed(2),
        status: 'pending_review',
        submittedAt: new Date(),
      })
      .returning({ id: listings.id });
    listingId = inserted.id;
  } catch {
    return { error: 'Échec de la création du logement — réessaie.', success: false };
  }

  if (photoFiles.length > 0) {
    let photoUrls: string[];
    try {
      photoUrls = await Promise.all(photoFiles.map((file) => uploadListingPhoto(listingId, file)));
    } catch {
      return {
        error: "Échec de l'envoi des photos — le logement a été créé mais reste à compléter.",
        success: false,
      };
    }

    await db
      .insert(listingPhotos)
      .values(photoUrls.map((url, position) => ({ listingId, url, position })));
  }

  if (certificationDocumentFile) {
    try {
      const path = await uploadCertificationDocument(listingId, certificationDocumentFile);
      await db
        .update(listings)
        .set({ certificationDocumentPath: path })
        .where(eq(listings.id, listingId));
    } catch {
      return {
        error: "Échec de l'envoi du justificatif — le logement a été créé mais reste à compléter.",
        success: false,
      };
    }
  }

  try {
    await db.insert(listingFestivals).values({
      listingId,
      festivalId,
      distanceKm: distanceKm !== null ? distanceKm.toFixed(2) : null,
      hasShuttle,
      shuttleCost: shuttleCost.toFixed(2),
      arrivalBufferBefore: arrivalBufferDays,
      arrivalBufferAfter: arrivalBufferDays,
    });
  } catch {
    return {
      error: "Échec de l'association au festival — le logement a été créé mais reste à compléter.",
      success: false,
    };
  }

  revalidatePath('/admin/logements');

  return { error: null, success: true };
}

export async function updateListingAction(
  _prevState: CreateListingActionState,
  formData: FormData
): Promise<CreateListingActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Tu dois être connecté.', success: false };
  }

  const listingId = String(formData.get('listingId') ?? '').trim();
  if (!listingId) {
    return { error: 'Logement introuvable.', success: false };
  }

  const [existing] = await db.select().from(listings).where(eq(listings.id, listingId)).limit(1);
  if (!existing || existing.hostId !== user.id) {
    return { error: 'Logement introuvable.', success: false };
  }

  const parsed = parseListingForm(formData);
  if (!parsed.success) return { error: parsed.error, success: false };
  const {
    fields,
    photoFiles,
    keepPhotoIds,
    certificationDocumentFile,
    removeCertificationDocument,
    festivalId,
    distanceKm,
    hasShuttle,
    shuttleCost,
    arrivalBufferDays,
  } = parsed;

  // Justificatif : upload avant l'écriture en base pour connaître le nouveau chemin (remplace
  // l'ancien) ; l'ancien fichier est supprimé du bucket privé après coup, best-effort (données
  // personnelles — contrairement aux photos, on ne les laisse pas orphelines en Storage).
  let nextCertificationDocumentPath: string | null | undefined;
  if (certificationDocumentFile) {
    try {
      nextCertificationDocumentPath = await uploadCertificationDocument(
        listingId,
        certificationDocumentFile
      );
    } catch {
      return {
        error:
          "Échec de l'envoi du justificatif — le reste des modifications n'a pas été enregistré.",
        success: false,
      };
    }
  } else if (removeCertificationDocument) {
    nextCertificationDocumentPath = null;
  }

  try {
    await db
      .update(listings)
      .set({
        ...fields,
        pricePerNight: fields.pricePerNight.toFixed(2),
        updatedAt: new Date(),
        ...(nextCertificationDocumentPath !== undefined
          ? { certificationDocumentPath: nextCertificationDocumentPath }
          : {}),
        // Toute modification repasse la fiche en modération (dbshema.md §4.3/§4.7) — y compris
        // depuis `published` : le logement redevient indisponible publiquement (les pages
        // publiques ne montrent que `status = 'published'`) tant qu'un admin ne l'a pas revalidé.
        status: 'pending_review' as const,
        rejectionReason: null,
        reviewedBy: null,
        reviewedAt: null,
        submittedAt: new Date(),
      })
      .where(eq(listings.id, listingId));
  } catch {
    return { error: 'Échec de la mise à jour — réessaie.', success: false };
  }

  if (
    nextCertificationDocumentPath !== undefined &&
    existing.certificationDocumentPath &&
    existing.certificationDocumentPath !== nextCertificationDocumentPath
  ) {
    await deleteCertificationDocument(existing.certificationDocumentPath).catch(() => {});
  }

  // Photos : supprime celles qui ne sont plus dans keepPhotoIds, ajoute les nouvelles.
  const currentPhotos = await db
    .select({ id: listingPhotos.id })
    .from(listingPhotos)
    .where(eq(listingPhotos.listingId, listingId));
  const toRemoveIds = currentPhotos.map((p) => p.id).filter((id) => !keepPhotoIds.includes(id));
  if (toRemoveIds.length > 0) {
    await db.delete(listingPhotos).where(inArray(listingPhotos.id, toRemoveIds));
  }

  if (photoFiles.length > 0) {
    let photoUrls: string[];
    try {
      photoUrls = await Promise.all(photoFiles.map((file) => uploadListingPhoto(listingId, file)));
    } catch {
      return {
        error:
          "Échec de l'envoi des nouvelles photos — le reste des modifications a été enregistré.",
        success: false,
      };
    }
    await db
      .insert(listingPhotos)
      .values(photoUrls.map((url, i) => ({ listingId, url, position: keepPhotoIds.length + i })));
  }

  try {
    await db
      .update(listingFestivals)
      .set({
        festivalId,
        distanceKm: distanceKm !== null ? distanceKm.toFixed(2) : null,
        hasShuttle,
        shuttleCost: shuttleCost.toFixed(2),
        arrivalBufferBefore: arrivalBufferDays,
        arrivalBufferAfter: arrivalBufferDays,
      })
      .where(eq(listingFestivals.listingId, listingId));
  } catch {
    return {
      error: "Échec de la mise à jour de l'association au festival.",
      success: false,
    };
  }

  revalidatePath(`/logements/${listingId}`);
  revalidatePath(`/logements/${listingId}/modifier`);
  revalidatePath('/admin/logements');

  return { error: null, success: true };
}

/**
 * Un logement avec au moins une réservation acceptée ne peut pas être supprimé — utilisé à la
 * fois pour griser le bouton de suppression côté page et pour revérifier côté serveur avant
 * d'agir (jamais fait confiance à l'état désactivé du bouton seul, voir deleteListingAction).
 */
export async function listingHasActiveBooking(listingId: string): Promise<boolean> {
  const [activeBooking] = await db
    .select({ id: bookings.id })
    .from(bookings)
    .innerJoin(listingFestivals, eq(bookings.listingFestivalId, listingFestivals.id))
    .where(and(eq(listingFestivals.listingId, listingId), eq(bookings.status, 'accepted')))
    .limit(1);

  return Boolean(activeBooking);
}

export type DeleteListingActionState = { error: string | null };

export async function deleteListingAction(
  _prevState: DeleteListingActionState,
  formData: FormData
): Promise<DeleteListingActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Tu dois être connecté.' };
  }

  const listingId = String(formData.get('listingId') ?? '').trim();
  if (!listingId) {
    return { error: 'Logement introuvable.' };
  }

  const [existing] = await db.select().from(listings).where(eq(listings.id, listingId)).limit(1);
  if (!existing || existing.hostId !== user.id) {
    return { error: 'Logement introuvable.' };
  }

  if (await listingHasActiveBooking(listingId)) {
    return {
      error: 'Tu as une réservation en cours, tu ne peux pas supprimer ton logement.',
    };
  }

  // Justificatif : donnée personnelle stockée dans un bucket privé, jamais laissée orpheline
  // (contrairement aux photos, voir même logique dans updateListingAction). Les photos et les
  // lignes listingFestivals/bookings liées sont supprimées en cascade par la base (onDelete:
  // 'cascade', voir src/db/schema.ts).
  if (existing.certificationDocumentPath) {
    await deleteCertificationDocument(existing.certificationDocumentPath).catch(() => {});
  }

  try {
    await db.delete(listings).where(eq(listings.id, listingId));
  } catch {
    return { error: 'Échec de la suppression du logement — réessaie.' };
  }

  revalidatePath('/compte');
  revalidatePath('/admin/logements');
  redirect('/compte');
}
