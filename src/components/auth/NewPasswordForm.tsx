'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { type FormEvent, useEffect, useState } from 'react';

import { createClient } from '@/lib/supabase/client';

/**
 * Formulaire de choix d'un nouveau mot de passe — utilisé à la fois depuis le lien reçu par
 * email (le SDK Supabase détecte le jeton dans l'URL au chargement et déclenche l'événement
 * `PASSWORD_RECOVERY`, cf. `detectSessionInUrl`) et par un utilisateur déjà connecté qui
 * arriverait directement sur cette page (sa session existante suffit).
 */
export function NewPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [checking, setChecking] = useState(true);
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [success, setSuccess] = useState(false);
  
  useEffect(() => {
  const supabase = createClient();
  const code = searchParams.get('code');

  async function initialize() {
    // Lien de récupération Supabase en PKCE
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        console.error('Password recovery code exchange failed:', error);
        setReady(false);
        setChecking(false);
        return;
      }

      setReady(true);
      setChecking(false);

      // Le code PKCE est à usage unique : on le retire de l'URL
      router.replace('/mot-de-passe-oublie/nouveau');
      return;
    }

    // Permet également à un utilisateur déjà connecté
    // d'accéder directement à cette page.
    const {
      data: { session },
    } = await supabase.auth.getSession();

    setReady(Boolean(session));
    setChecking(false);
  }

  void initialize();
}, [router, searchParams]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError('Le mot de passe doit faire au moins 6 caractères.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }

    setPending(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setPending(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setSuccess(true);
    setTimeout(() => router.push('/compte'), 2000);
  }

  if (checking) {
    return <p className="text-sm text-gray-500">Vérification du lien…</p>;
  }

  if (!ready) {
    return (
      <p
        role="alert"
        className="rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-300"
      >
        Ce lien de réinitialisation est invalide ou a expiré.{' '}
        <a href="/mot-de-passe-oublie" className="font-medium underline">
          Demander un nouveau lien
        </a>
        .
      </p>
    );
  }

  if (success) {
    return (
      <p
        role="status"
        className="rounded border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-300"
      >
        Mot de passe mis à jour — redirection…
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="password" className="block text-sm font-medium">
          Nouveau mot de passe
        </label>
        <input
          id="password"
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-transparent"
        />
      </div>
      <div>
        <label htmlFor="confirmPassword" className="block text-sm font-medium">
          Confirmer le mot de passe
        </label>
        <input
          id="confirmPassword"
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-transparent"
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-gray-900"
      >
        {pending ? 'Mise à jour…' : 'Mettre à jour le mot de passe'}
      </button>
    </form>
  );
}
