import { NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);

  const code = searchParams.get('code');
  const next = searchParams.get('next');

  // Évite les redirections externes arbitraires.
  const redirectTo =
    next && next.startsWith('/') && !next.startsWith('//')
      ? next
      : '/';

  if (code) {
    const supabase = await createClient();

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(`${origin}${redirectTo}`);
    }

    console.error('Supabase auth callback error:', error);
  }

  return NextResponse.redirect(
    `${origin}/connexion?error=auth_callback`,
  );
}