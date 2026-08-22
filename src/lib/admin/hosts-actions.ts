'use server';

import { revalidatePath } from 'next/cache';

import { requireAdmin } from '@/lib/auth/admin';
import { createAdminClient } from '@/lib/supabase/admin';

// ~100 ans : pas de valeur "permanente" native côté Supabase, c'est la durée conventionnellement
// utilisée pour une suspension de fait indéfinie (annulable via reactivateHostAction).
const INDEFINITE_BAN_DURATION = '876000h';

export async function suspendHostAction(formData: FormData) {
  await requireAdmin();

  const userId = String(formData.get('userId') ?? '');
  if (!userId) return;

  const admin = createAdminClient();
  await admin.auth.admin.updateUserById(userId, { ban_duration: INDEFINITE_BAN_DURATION });

  revalidatePath('/admin/hotes');
}

export async function reactivateHostAction(formData: FormData) {
  await requireAdmin();

  const userId = String(formData.get('userId') ?? '');
  if (!userId) return;

  const admin = createAdminClient();
  await admin.auth.admin.updateUserById(userId, { ban_duration: 'none' });

  revalidatePath('/admin/hotes');
}
