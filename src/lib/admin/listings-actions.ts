'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

import { db } from '@/db/client';
import { listings } from '@/db/schema';
import { requireAdmin } from '@/lib/auth/admin';

export async function approveListingAction(formData: FormData) {
  const { dbUser } = await requireAdmin();

  const listingId = String(formData.get('listingId') ?? '');
  if (!listingId) return;

  await db
    .update(listings)
    .set({
      status: 'published',
      reviewedBy: dbUser.id,
      reviewedAt: new Date(),
      rejectionReason: null,
    })
    .where(eq(listings.id, listingId));

  revalidatePath('/admin/logements');
}

export async function rejectListingAction(formData: FormData) {
  const { dbUser } = await requireAdmin();

  const listingId = String(formData.get('listingId') ?? '');
  const reason = String(formData.get('reason') ?? '').trim();
  if (!listingId || !reason) return;

  await db
    .update(listings)
    .set({
      status: 'rejected',
      reviewedBy: dbUser.id,
      reviewedAt: new Date(),
      rejectionReason: reason,
    })
    .where(eq(listings.id, listingId));

  revalidatePath('/admin/logements');
}
