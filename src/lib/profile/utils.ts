/**
 * Prénom uniquement. Utilisé quand l'affichage complet n'est pas justifié par une relation
 * établie — ex. le nom de l'hôte affiché à un festivalier sur une fiche logement, avant toute
 * demande. Ne pas utiliser pour restreindre l'inverse : depuis une demande de mise en relation,
 * l'hôte voit le nom complet du festivalier (booking-requests-setup.md §10, dbshema.md §5).
 */
export function getFirstName(fullName: string | null): string {
  if (!fullName) return 'Utilisateur';
  return fullName.trim().split(/\s+/)[0] ?? 'Utilisateur';
}

/** Âge en années révolues à partir de la date de naissance — jamais la date elle-même n'est exposée. */
export function computeAge(birthDate: Date | string | null): number | null {
  if (!birthDate) return null;
  const birth = typeof birthDate === 'string' ? new Date(birthDate) : birthDate;
  if (Number.isNaN(birth.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const hasHadBirthdayThisYear =
    today.getMonth() > birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() >= birth.getDate());
  if (!hasHadBirthdayThisYear) {
    age -= 1;
  }
  return age;
}
