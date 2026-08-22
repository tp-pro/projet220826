'use server';

import { contactMessages } from '@/db/schema';
import { db } from '@/db/client';
import { type ContactActionState } from '@/lib/contact/types';

// Format volontairement simple (pas de validation RFC 5322 complète), mais exclut les
// caractères qui n'ont rien à faire dans une adresse email — notamment `?`/`&`, qui
// permettraient d'injecter des paramètres (bcc, subject...) dans le lien `mailto:` généré
// pour l'admin sur /admin/messages.
const EMAIL_PATTERN = /^[^\s@?&]+@[^\s@?&]+\.[^\s@?&]+$/;

export async function sendContactMessageAction(
  _prevState: ContactActionState,
  formData: FormData
): Promise<ContactActionState> {
  const name = String(formData.get('name') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim();
  const message = String(formData.get('message') ?? '').trim();

  if (!name || !email || !message) {
    return { error: 'Merci de remplir tous les champs.', success: false };
  }
  if (!EMAIL_PATTERN.test(email)) {
    return { error: 'Adresse email invalide.', success: false };
  }

  try {
    await db.insert(contactMessages).values({ name, email, message });
  } catch {
    return { error: "Échec de l'envoi — réessaie.", success: false };
  }

  return { error: null, success: true };
}
