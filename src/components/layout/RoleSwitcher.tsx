'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Routes "hôte" sous /logements/* — tout le reste sous /logements/* (ex: /logements/<id>,
// la fiche d'un logement) relève du parcours festivalier. Une route dynamique par id ne peut
// jamais valoir "nouveau" ou "demandes" (routes statiques prioritaires côté Next.js), donc pas
// d'ambiguïté possible entre les deux listes ci-dessous.
const HOST_LOGEMENTS_PATHS = ['/logements/nouveau', '/logements/demandes'];

function matchesPath(pathname: string, base: string) {
  return pathname === base || pathname.startsWith(`${base}/`);
}

function isHostPath(pathname: string) {
  // /logements/<id>/modifier (édition de sa propre fiche) est aussi une route "hôte",
  // à distinguer de /logements/<id> (fiche publique, parcours festivalier).
  return (
    HOST_LOGEMENTS_PATHS.some((base) => matchesPath(pathname, base)) ||
    pathname.endsWith('/modifier')
  );
}

const MODES = [
  // "Festivalier" : accueil, festivals, fiche logement (/logements/<id>), et ses demandes
  // envoyées — tout ce qui n'est pas explicitement une route "hôte".
  {
    href: '/',
    label: 'Festivalier',
    isActive: (p: string) =>
      p === '/' ||
      matchesPath(p, '/festivals') ||
      matchesPath(p, '/mes-demandes') ||
      (matchesPath(p, '/logements') && !isHostPath(p)),
  },
  {
    href: '/logements/nouveau',
    label: 'Hôte',
    isActive: (p: string) => isHostPath(p),
  },
] as const;

export function RoleSwitcher() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Changer de profil"
      className="flex items-center rounded-full border border-border bg-map p-0.5 text-sm"
    >
      {MODES.map(({ href, label, isActive: checkActive }) => {
        const isActive = checkActive(pathname);

        return (
          <Link
            key={href}
            href={href}
            aria-current={isActive ? 'page' : undefined}
            className={`rounded-full px-3 py-1 transition-colors ${
              isActive ? 'bg-beacon text-surface' : 'text-contour hover:text-ink'
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
