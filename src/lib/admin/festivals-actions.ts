'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { db } from '@/db/client';
import { festivalCategoryEnum, festivals } from '@/db/schema';
import { ALLOWED_COVER_TYPES, MAX_COVER_SIZE_BYTES } from '@/lib/festivals/constants';
import { uploadFestivalCover } from '@/lib/festivals/storage';
import { requireAdmin } from '@/lib/auth/admin';

export type FestivalActionState = { error: string | null };

type ParsedFestivalForm =
  | { success: false; error: string }
  | {
      success: true;
      values: {
        name: string;
        slug: string;
        city: string;
        country: string;
        description: string | null;
        categories: (typeof festivalCategoryEnum.enumValues)[number][];
        dateStart: Date;
        dateEnd: Date;
        status: 'draft' | 'published';
      };
      coverFile: File | null;
      removeCoverImage: boolean;
    };

function parseFestivalForm(formData: FormData): ParsedFestivalForm {
  const name = String(formData.get('name') ?? '').trim();
  const slug = String(formData.get('slug') ?? '').trim();
  const city = String(formData.get('city') ?? '').trim();
  const country = String(formData.get('country') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  // Checkboxes cochées de même `name` → une entrée par valeur dans la FormData. On ne fait
  // jamais confiance au client : seules les valeurs de l'enum sont retenues, dédupliquées.
  const allowedCategories = festivalCategoryEnum.enumValues as readonly string[];
  const submittedCategories = formData.getAll('categories').map((value) => String(value));
  const categories = [...new Set(submittedCategories)].filter((value) =>
    allowedCategories.includes(value)
  ) as (typeof festivalCategoryEnum.enumValues)[number][];
  const dateStart = String(formData.get('dateStart') ?? '');
  const dateEnd = String(formData.get('dateEnd') ?? '');
  const status = String(formData.get('status') ?? 'draft');

  if (!name || !slug || !city || !country || !dateStart || !dateEnd) {
    return { success: false, error: 'Merci de remplir tous les champs obligatoires.' };
  }

  const coverFileRaw = formData.get('coverImage');
  const coverFile = coverFileRaw instanceof File && coverFileRaw.size > 0 ? coverFileRaw : null;
  const removeCoverImage = formData.get('removeCoverImage') === 'on';

  if (coverFile) {
    if (!(ALLOWED_COVER_TYPES as readonly string[]).includes(coverFile.type)) {
      return { success: false, error: "Formats acceptés pour l'image : JPEG, PNG, WEBP." };
    }
    if (coverFile.size > MAX_COVER_SIZE_BYTES) {
      return { success: false, error: "L'image de couverture doit faire moins de 5 Mo." };
    }
  }

  return {
    success: true,
    values: {
      name,
      slug,
      city,
      country,
      description: description || null,
      categories,
      dateStart: new Date(dateStart),
      dateEnd: new Date(dateEnd),
      status: status === 'published' ? 'published' : 'draft',
    },
    coverFile,
    removeCoverImage,
  };
}

export async function createFestivalAction(
  _prevState: FestivalActionState,
  formData: FormData
): Promise<FestivalActionState> {
  const { dbUser } = await requireAdmin();

  const parsed = parseFestivalForm(formData);
  if (!parsed.success) return { error: parsed.error };

  let festivalId: string;
  try {
    const [inserted] = await db
      .insert(festivals)
      .values({ ...parsed.values, createdBy: dbUser.id })
      .returning({ id: festivals.id });
    festivalId = inserted.id;
  } catch {
    return { error: 'Échec de la création — le slug est peut-être déjà utilisé.' };
  }

  if (parsed.coverFile) {
    try {
      const coverImageUrl = await uploadFestivalCover(festivalId, parsed.coverFile);
      await db.update(festivals).set({ coverImageUrl }).where(eq(festivals.id, festivalId));
    } catch {
      return {
        error:
          "Festival créé, mais l'upload de l'image a échoué — tu peux réessayer depuis l'édition.",
      };
    }
  }

  revalidatePath('/admin/festivals');
  redirect('/admin/festivals');
}

export type DeleteFestivalActionState = { error: string | null };

/**
 * Suppression définitive d'un festival. `ON DELETE CASCADE` (voir src/db/schema.ts) supprime
 * aussi les associations logement↔festival, les demandes de mise en relation et les avis qui
 * en découlent pour ce festival — jamais les logements eux-mêmes (indépendants du festival).
 * Confirmation côté client (voir DeleteFestivalButton.tsx) avant tout envoi du formulaire.
 */
export async function deleteFestivalAction(
  _prevState: DeleteFestivalActionState,
  formData: FormData
): Promise<DeleteFestivalActionState> {
  await requireAdmin();

  const id = String(formData.get('id') ?? '');
  if (!id) return { error: 'Festival introuvable.' };

  try {
    await db.delete(festivals).where(eq(festivals.id, id));
  } catch {
    return { error: 'Échec de la suppression du festival.' };
  }

  revalidatePath('/admin/festivals');
  redirect('/admin/festivals');
}

export async function updateFestivalAction(
  _prevState: FestivalActionState,
  formData: FormData
): Promise<FestivalActionState> {
  await requireAdmin();

  const id = String(formData.get('id') ?? '');
  if (!id) return { error: 'Festival introuvable.' };

  const parsed = parseFestivalForm(formData);
  if (!parsed.success) return { error: parsed.error };

  // `undefined` = on ne touche pas à la colonne (garde l'image actuelle en base) ; jamais
  // fait confiance à une URL transmise par le client, seule l'app côté serveur décide.
  let coverImageUrl: string | null | undefined;
  if (parsed.coverFile) {
    try {
      coverImageUrl = await uploadFestivalCover(id, parsed.coverFile);
    } catch {
      return { error: "Échec de l'upload de l'image — réessaie." };
    }
  } else if (parsed.removeCoverImage) {
    coverImageUrl = null;
  }

  try {
    await db
      .update(festivals)
      .set({
        ...parsed.values,
        ...(coverImageUrl !== undefined ? { coverImageUrl } : {}),
      })
      .where(eq(festivals.id, id));
  } catch {
    return { error: 'Échec de la mise à jour — le slug est peut-être déjà utilisé.' };
  }

  revalidatePath('/admin/festivals');
  redirect('/admin/festivals');
}
