/**
 * Seed de données fictives pour tester la solution en local.
 *
 * ⚠️ Crée de vrais comptes Supabase Auth (déjà confirmés, via la clé service_role) pour
 * pouvoir se connecter immédiatement sans passer par la confirmation email — réservé au
 * développement. Idempotent : relancer ce script nettoie d'abord les données précédemment
 * seedées (même emails/slugs) avant de tout recréer.
 *
 * Usage : npm run db:seed
 */
import { eq, inArray } from 'drizzle-orm';

import { env } from '../src/config/env';
import { closeDb, db } from '../src/db/client';
import {
  bookings,
  festivals,
  listingFestivals,
  listingPhotos,
  listings,
  reviews,
  users,
} from '../src/db/schema';
import { createAdminClient } from '../src/lib/supabase/admin';

const SEED_PASSWORD = 'test1234';

const SEED_USERS = [
  { email: 'admin@festcamp.test', fullName: 'Admin Festcamp' },
  { email: 'host1@festcamp.test', fullName: 'Julie Martin' },
  { email: 'host2@festcamp.test', fullName: 'Marc Dubois' },
  { email: 'guest1@festcamp.test', fullName: 'Sophie Bernard' },
  { email: 'guest2@festcamp.test', fullName: 'Karim Haddad' },
  { email: 'both1@festcamp.test', fullName: 'Léa Rousseau' },
] as const;

const FESTIVAL_SLUGS = [
  'dour-festival-2026',
  'hellfest-2026',
  'fusion-festival-2026',
  'vieilles-charrues-2026',
  'astropolis-2027',
  'eurockeennes-2027',
  'etonnants-voyageurs-2027',
  'livre-sur-la-place-2026',
  'festival-america-2027',
] as const;

function photoUrl(seed: string) {
  return `https://picsum.photos/seed/festcamp-${seed}/800/600`;
}

async function resetPreviousSeed(admin: ReturnType<typeof createAdminClient>) {
  console.log('→ Nettoyage des données de seed précédentes…');

  // Cascade vers listings, listing_photos, listing_festivals, bookings, reviews (FK ON DELETE CASCADE)
  await db.delete(users).where(
    inArray(
      users.email,
      SEED_USERS.map((u) => u.email)
    )
  );
  await db.delete(festivals).where(inArray(festivals.slug, [...FESTIVAL_SLUGS]));

  // Supprime aussi les comptes Supabase Auth correspondants
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const seedEmails = new Set<string>(SEED_USERS.map((u) => u.email));
  for (const authUser of data?.users ?? []) {
    if (authUser.email && seedEmails.has(authUser.email)) {
      await admin.auth.admin.deleteUser(authUser.id);
    }
  }
}

async function createSeedUsers(admin: ReturnType<typeof createAdminClient>) {
  console.log('→ Création des comptes de test (Supabase Auth + public.users via trigger)…');

  const idByEmail = new Map<string, string>();

  for (const { email, fullName } of SEED_USERS) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: SEED_PASSWORD,
      email_confirm: true, // pré-confirmé : connexion immédiate possible
      user_metadata: { full_name: fullName },
    });

    if (error || !data.user) {
      throw new Error(`Échec création ${email}: ${error?.message}`);
    }

    idByEmail.set(email, data.user.id);
  }

  // admin@festcamp.test est le seul compte avec le rôle admin (accès /admin)
  await db
    .update(users)
    .set({ role: 'admin' })
    .where(eq(users.id, idByEmail.get('admin@festcamp.test')!));

  // Petite touche de réalisme sur quelques profils hôtes
  await db
    .update(users)
    .set({ bio: "Festivalière depuis 10 ans, toujours ravie d'accueillir d'autres passionnés !" })
    .where(eq(users.id, idByEmail.get('host1@festcamp.test')!));
  await db
    .update(users)
    .set({ bio: 'Je loue ma maison chaque été pendant les Vieilles Charrues.' })
    .where(eq(users.id, idByEmail.get('host2@festcamp.test')!));

  return idByEmail;
}

async function main() {
  console.log(`Seed sur : ${env.NEXT_PUBLIC_SUPABASE_URL}\n`);

  const admin = createAdminClient();

  await resetPreviousSeed(admin);
  const userId = await createSeedUsers(admin);

  console.log('→ Création des festivals…');
  const insertedFestivals = await db
    .insert(festivals)
    .values([
      {
        name: 'Dour Festival',
        slug: 'dour-festival-2026',
        city: 'Dour',
        country: 'BE',
        description:
          'Cinq jours de musique électronique et de scènes en pleine nature, au cœur du Borinage belge.',
        categories: ['musique', 'evenementiel'],
        dateStart: new Date('2026-07-15'),
        dateEnd: new Date('2026-07-19'),
        coverImageUrl: photoUrl('dour'),
        status: 'published',
        createdBy: userId.get('admin@festcamp.test'),
      },
      {
        name: 'Hellfest',
        slug: 'hellfest-2026',
        city: 'Clisson',
        country: 'FR',
        description:
          'Le rendez-vous metal et rock incontournable, sur plusieurs scènes en plein air.',
        categories: ['musique'],
        dateStart: new Date('2026-06-18'),
        dateEnd: new Date('2026-06-21'),
        coverImageUrl: photoUrl('hellfest'),
        status: 'published',
        createdBy: userId.get('admin@festcamp.test'),
      },
      {
        name: 'Fusion Festival',
        slug: 'fusion-festival-2026',
        city: 'Lärz',
        country: 'DE',
        categories: ['musique', 'culturel'],
        dateStart: new Date('2026-06-24'),
        dateEnd: new Date('2026-06-29'),
        coverImageUrl: photoUrl('fusion'),
        status: 'published',
        createdBy: userId.get('admin@festcamp.test'),
      },
      {
        name: 'Vieilles Charrues',
        slug: 'vieilles-charrues-2026',
        city: 'Carhaix',
        country: 'FR',
        categories: ['musique', 'evenementiel'],
        dateStart: new Date('2026-07-16'),
        dateEnd: new Date('2026-07-19'),
        coverImageUrl: photoUrl('charrues'),
        status: 'draft', // démontre le statut non publié
        createdBy: userId.get('admin@festcamp.test'),
      },
      {
        name: 'Astropolis',
        slug: 'astropolis-2027',
        city: 'Brest',
        country: 'FR',
        description:
          'Le festival électronique de référence sur la pointe bretonne, entre plages et hangars réhabilités.',
        categories: ['musique', 'evenementiel'],
        dateStart: new Date('2027-08-12'),
        dateEnd: new Date('2027-08-15'),
        coverImageUrl: photoUrl('astropolis'),
        status: 'published',
        createdBy: userId.get('admin@festcamp.test'),
      },
      {
        name: 'Eurockéennes',
        slug: 'eurockeennes-2027',
        city: 'Belfort',
        country: 'FR',
        description:
          'Trois jours de rock, pop et découvertes musicales au bord du lac de Malsaucy.',
        categories: ['musique', 'evenementiel'],
        dateStart: new Date('2027-07-02'),
        dateEnd: new Date('2027-07-04'),
        coverImageUrl: photoUrl('eurockeennes'),
        status: 'published',
        createdBy: userId.get('admin@festcamp.test'),
      },
      {
        name: 'Étonnants Voyageurs',
        slug: 'etonnants-voyageurs-2027',
        city: 'Saint-Malo',
        country: 'FR',
        description:
          'Le rendez-vous des littératures du monde et du récit de voyage, sur les remparts de la cité corsaire.',
        categories: ['litteraire', 'culturel'],
        dateStart: new Date('2027-05-22'),
        dateEnd: new Date('2027-05-24'),
        coverImageUrl: photoUrl('voyageurs'),
        status: 'published',
        createdBy: userId.get('admin@festcamp.test'),
      },
      {
        name: 'Le Livre sur la Place',
        slug: 'livre-sur-la-place-2026',
        city: 'Nancy',
        country: 'FR',
        description:
          "Un des plus grands salons du livre de France, avec plusieurs centaines d'auteurs invités.",
        categories: ['litteraire', 'evenementiel'],
        dateStart: new Date('2026-09-11'),
        dateEnd: new Date('2026-09-13'),
        coverImageUrl: photoUrl('nancy'),
        status: 'published',
        createdBy: userId.get('admin@festcamp.test'),
      },
      {
        name: 'Festival America',
        slug: 'festival-america-2027',
        city: 'Vincennes',
        country: 'FR',
        description:
          'Le festival de la littérature nord-américaine, rencontres et lectures au cœur du bois de Vincennes.',
        categories: ['litteraire', 'culturel'],
        dateStart: new Date('2027-09-16'),
        dateEnd: new Date('2027-09-19'),
        coverImageUrl: photoUrl('america'),
        status: 'published',
        createdBy: userId.get('admin@festcamp.test'),
      },
    ])
    .returning({ id: festivals.id, slug: festivals.slug });

  const festivalId = new Map(insertedFestivals.map((f) => [f.slug, f.id]));

  console.log('→ Création des logements…');
  // Un hôte ne peut créer qu'un seul logement (voir dbshema.md §4.7) — un par hôte ci-dessous.
  const insertedListings = await db
    .insert(listings)
    .values([
      {
        hostId: userId.get('host1@festcamp.test')!,
        title: 'Grand jardin pour camper - Fusion Festival',
        description: 'Emplacements ombragés, accès douche et électricité.',
        address: 'Am See 3',
        city: 'Lärz',
        country: 'DE',
        type: 'camping_spot',
        spotsTotal: 10,
        pricePerNight: '15.00',
        status: 'published',
        submittedAt: new Date(),
        reviewedBy: userId.get('admin@festcamp.test'),
        reviewedAt: new Date(),
      },
      {
        hostId: userId.get('host2@festcamp.test')!,
        title: 'Canapé dispo pour 1 festivalier',
        description: 'Canapé-lit dans mon salon, ambiance conviviale garantie.',
        address: '22 rue du Moulin',
        city: 'Clisson',
        country: 'FR',
        type: 'couch',
        spotsTotal: 1,
        pricePerNight: '15.00',
        status: 'published',
        submittedAt: new Date(),
        reviewedBy: userId.get('admin@festcamp.test'),
        reviewedAt: new Date(),
      },
      {
        hostId: userId.get('both1@festcamp.test')!,
        title: 'Studio indépendant proche Hellfest',
        description: 'Studio avec entrée privée, à 20 min à pied du site.',
        address: '3 quai de la Sèvre',
        city: 'Clisson',
        country: 'FR',
        type: 'entire_place',
        maxGuests: 2,
        pricePerNight: '40.00',
        status: 'published',
        submittedAt: new Date(),
        reviewedBy: userId.get('admin@festcamp.test'),
        reviewedAt: new Date(),
      },
    ])
    .returning({ id: listings.id, title: listings.title });

  const listingId = new Map(insertedListings.map((l) => [l.title, l.id]));

  console.log('→ Ajout des photos de logement…');
  await db.insert(listingPhotos).values(
    insertedListings.flatMap((l, i) => [
      { listingId: l.id, url: photoUrl(`listing-${i}-a`), position: 0 },
      { listingId: l.id, url: photoUrl(`listing-${i}-b`), position: 1 },
    ])
  );

  console.log('→ Association logements ↔ festivals…');
  const insertedListingFestivals = await db
    .insert(listingFestivals)
    .values([
      {
        listingId: listingId.get('Grand jardin pour camper - Fusion Festival')!,
        festivalId: festivalId.get('fusion-festival-2026')!,
      },
      {
        listingId: listingId.get('Canapé dispo pour 1 festivalier')!,
        festivalId: festivalId.get('hellfest-2026')!,
      },
      {
        listingId: listingId.get('Studio indépendant proche Hellfest')!,
        festivalId: festivalId.get('hellfest-2026')!,
      },
    ])
    .returning({
      id: listingFestivals.id,
      listingId: listingFestivals.listingId,
      festivalId: listingFestivals.festivalId,
    });

  const lfByListingTitle = new Map(
    insertedListingFestivals.map((lf) => {
      const title = insertedListings.find((l) => l.id === lf.listingId)!.title;
      return [title, lf.id];
    })
  );

  console.log("→ Création des réservations d'exemple…");
  const insertedBookings = await db
    .insert(bookings)
    .values([
      {
        listingFestivalId: lfByListingTitle.get('Grand jardin pour camper - Fusion Festival')!,
        guestId: userId.get('guest1@festcamp.test')!,
        guestsCount: 2,
        spotsBooked: 2,
        status: 'accepted',
        message: 'On arrive le vendredi matin, ça vous va ?',
        priceAgreed: '210.00',
        respondedAt: new Date(),
      },
      {
        listingFestivalId: lfByListingTitle.get('Canapé dispo pour 1 festivalier')!,
        guestId: userId.get('guest2@festcamp.test')!,
        guestsCount: 1,
        spotsBooked: 1,
        status: 'pending',
        message: 'Toujours dispo pour les dates du Hellfest ?',
      },
      {
        // démontre le double rôle host/guest : both1 est hôte de son propre logement
        // (Studio indépendant) mais festivalier ici, sur le logement de host2.
        listingFestivalId: lfByListingTitle.get('Canapé dispo pour 1 festivalier')!,
        guestId: userId.get('both1@festcamp.test')!,
        guestsCount: 1,
        status: 'rejected',
        message: 'Bonjour, une place dispo pour une personne ?',
        respondedAt: new Date(),
      },
    ])
    .returning({ id: bookings.id, status: bookings.status, guestId: bookings.guestId });

  const acceptedBooking = insertedBookings.find((b) => b.status === 'accepted')!;

  console.log('→ Création des avis…');
  await db.insert(reviews).values([
    {
      bookingId: acceptedBooking.id,
      authorId: userId.get('guest1@festcamp.test')!,
      targetId: userId.get('host1@festcamp.test')!,
      rating: 5,
      comment: 'Accueil parfait, emplacement bien ombragé, à 10 minutes à pied du festival !',
    },
    {
      bookingId: acceptedBooking.id,
      authorId: userId.get('host1@festcamp.test')!,
      targetId: userId.get('guest1@festcamp.test')!,
      rating: 5,
      comment: 'Festivalière très respectueuse, communication facile.',
    },
  ]);

  console.log('\n✅ Seed terminé.\n');
  console.log('Comptes de test (mot de passe unique, dev uniquement) :');
  console.log(`  Mot de passe : ${SEED_PASSWORD}`);
  for (const u of SEED_USERS) {
    console.log(`  - ${u.email}  (${u.fullName})`);
  }
}

main()
  .catch((err) => {
    console.error('\n❌ Échec du seed :', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb();
  });
