'use client';

import type { EmailOtpType } from '@supabase/supabase-js';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

import { createClient } from '@/lib/supabase/client';

/**
 * Où renvoyer l'utilisateur une fois le lien confirmé, selon le type d'email — `next` dans
 * l'URL (voir gabarit d'email, §ci-dessous) prend le dessus si fourni.
 */
const DEFAULT_NEXT_BY_TYPE: Partial<Record<EmailOtpType, string>> = {
  recovery: '/mot-de-passe-oublie/nouveau',
  signup: '/connexion',
  email_change: '/compte',
  invite: '/compte',
};

/**
 * `next` vient de l'URL — donc potentiellement forgé par un tiers dans un lien de phishing —
 * jamais fait confiance sans le restreindre à un chemin interne (open redirect).
 *
 * ⚠️ Un filtrage par liste noire de caractères (`//`, `\`...) s'est révélé insuffisant : un
 * caractère de contrôle encodé (ex. tabulation `%09`) glissé dans `next` passe un tel filtre
 * tout en étant normalisé en `//evil.com` par le parseur d'URL interne de `router.push()`,
 * provoquant une vraie navigation externe après le clic de confirmation (trouvé en revue de
 * sécurité). On utilise donc le même parseur WHATWG (`new URL`) que celui utilisé en interne
 * par Next.js pour résoudre `next` exactement comme il le fera, puis on ne garde que le résultat
 * si son origine reste bien celle du site — liste blanche par comportement réel, jamais par
 * motif de caractères.
 */
function safeNextPath(next: string | null): string | null {
  if (!next) return null;
  try {
    const url = new URL(next, window.location.origin);
    if (url.origin !== window.location.origin) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

/**
 * Confirmation d'un lien email (réinitialisation de mot de passe, inscription...) via
 * `token_hash`/`type` plutôt que le lien "prêt à l'emploi" par défaut de Supabase.
 *
 * ⚠️ Étape volontairement déclenchée par un clic explicite, jamais automatiquement au
 * chargement de la page : de nombreux clients mail (Gmail, Outlook Safe Links...) "pré-visitent"
 * automatiquement les liens d'un email reçu pour les scanner (anti-phishing), ce qui consomme
 * silencieusement un jeton à usage unique avant même que l'utilisateur ne clique — l'utilisateur
 * tombe alors sur un lien "expiré" dès sa première vraie tentative. Un clic humain n'est jamais
 * déclenché par ces scanners automatisés, d'où la confirmation en deux temps ici.
 *
 * Nécessite que le gabarit d'email (Supabase Dashboard → Authentication → Email Templates)
 * pointe vers cette page avec `token_hash`/`type` plutôt que `{{ .ConfirmationURL }}`, ex. pour
 * "Reset Password" :
 *   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/mot-de-passe-oublie/nouveau
 */
export function ConfirmEmailAction() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const next = searchParams.get('next');

  if (!tokenHash || !type) {
    return (
      <p
        role="alert"
        className="rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-300"
      >
        Lien invalide — il manque des informations. Réessaie de suivre le lien reçu par email.
      </p>
    );
  }

  async function handleConfirm() {
    setPending(true);
    setError(null);

    const supabase = createClient();
    const { error: verifyError } = await supabase.auth.verifyOtp({
      token_hash: tokenHash!,
      type: type!,
    });

    setPending(false);

    if (verifyError) {
      setError(
        "Ce lien n'est plus valide — il a peut-être déjà été utilisé ou a expiré. Redemande un nouveau lien."
      );
      return;
    }

    router.push(safeNextPath(next) || DEFAULT_NEXT_BY_TYPE[type!] || '/compte');
  }

  if (error) {
    return (
      <p
        role="alert"
        className="rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-300"
      >
        {error}{' '}
        <a href="/mot-de-passe-oublie" className="font-medium underline">
          Demander un nouveau lien
        </a>
        .
      </p>
    );
  }

  return (
    <div>
      <p className="text-sm text-gray-500">Clique ci-dessous pour confirmer et continuer.</p>
      <button
        type="button"
        onClick={handleConfirm}
        disabled={pending}
        className="mt-4 w-full rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-gray-900"
      >
        {pending ? 'Confirmation…' : 'Confirmer'}
      </button>
    </div>
  );
}
