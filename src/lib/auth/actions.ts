'use server';

import { redirect } from 'next/navigation';

import { env } from '@/config/env';
import { type AuthActionState } from '@/lib/auth/types';
import { createClient } from '@/lib/supabase/server';

export async function signUpAction(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const fullName = String(formData.get('fullName') ?? '').trim();

  if (!email || !password) {
    return { error: 'Email et mot de passe requis.', message: null };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: fullName ? { full_name: fullName } : undefined,
      emailRedirectTo: `${env.NEXT_PUBLIC_APP_URL}/connexion`,
    },
  });

  if (error) {
    return { error: error.message, message: null };
  }

  return {
    error: null,
    message: 'Compte créé. Vérifie ta boîte mail pour confirmer ton adresse avant de te connecter.',
  };
}

export async function signInAction(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  if (!email || !password) {
    return { error: 'Email et mot de passe requis.', message: null };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: error.message, message: null };
  }

  redirect('/compte');
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/');
}

/**
 * Envoie un email de réinitialisation de mot de passe — répond toujours avec le même message
 * générique, que l'email corresponde ou non à un compte existant, pour ne jamais laisser un
 * tiers déduire quels emails sont enregistrés (énumération de comptes).
 */
export async function requestPasswordResetAction(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = String(formData.get('email') ?? '').trim();

  if (!email) {
    return { error: 'Email requis.', message: null };
  }

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${env.NEXT_PUBLIC_APP_URL}/mot-de-passe-oublie/nouveau`,
  });

  return {
    error: null,
    message:
      'Si un compte existe avec cet email, tu vas recevoir un lien pour choisir un nouveau mot de passe.',
  };
}
