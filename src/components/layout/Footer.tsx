import Link from 'next/link';

import { siteConfig } from '@/config/site';

export function Footer() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-muted">
        <span>
          © {new Date().getFullYear()} {siteConfig.name}
        </span>
        <nav aria-label="Liens du pied de page" className="flex flex-wrap gap-4">
          <Link href="/contact" className="text-contour hover:text-ink">
            Contact
          </Link>
          <Link href="/mentions-legales" className="text-contour hover:text-ink">
            Mentions légales
          </Link>
          <Link href="/politique-de-confidentialite" className="text-contour hover:text-ink">
            Politique de confidentialité
          </Link>
        </nav>
      </div>
    </footer>
  );
}
