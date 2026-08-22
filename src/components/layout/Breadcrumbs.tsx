import Link from 'next/link';

export type BreadcrumbItem = {
  label: string;
  /** Omis pour le dernier élément (page courante) — rendu en texte simple, pas un lien. */
  href?: string;
};

/**
 * Fil d'Ariane accessible (WAI-ARIA "Breadcrumb" pattern) — `nav` avec `aria-label` dédié +
 * liste ordonnée, dernier élément marqué `aria-current="page"` et non cliquable. Toujours
 * préfixé par "Accueil" ; les pages appelantes ne fournissent que la suite du fil.
 *
 * Absent volontairement de la page d'accueil (`/`) — c'est la racine du fil, rien à afficher.
 */
export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  const trail: BreadcrumbItem[] = [{ label: 'Accueil', href: '/' }, ...items];

  return (
    <nav aria-label="Fil d’Ariane" className="mb-4 text-sm text-gray-500 dark:text-gray-400">
      <ol className="flex flex-wrap items-center gap-x-1.5">
        {trail.map((item, index) => {
          const isCurrent = index === trail.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-x-1.5">
              {index > 0 && <span aria-hidden="true">/</span>}
              {isCurrent || !item.href ? (
                <span aria-current="page" className="font-medium">
                  {item.label}
                </span>
              ) : (
                <Link href={item.href} className="hover:underline">
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
