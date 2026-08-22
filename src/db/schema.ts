/**
 * Schéma de base de données Drizzle — voir /dbshema.md à la racine du projet
 * pour la documentation complète (règles métier, décisions produit, ERD).
 */
import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  check,
  customType,
  date,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

// ---------------------------------------------------------------------------
// Types custom
// ---------------------------------------------------------------------------

/**
 * Colonne géospatiale PostGIS (point WGS84).
 * Stockée/lue en WKT, ex: "POINT(4.3517 50.8503)" (lng lat).
 * L'extension `postgis` doit être activée sur la base (Supabase: Database > Extensions).
 *
 * Type déclaré en `geometry` (et non `geography`) car `drizzle-kit` ne reconnaît que
 * `geometry` comme type PostGIS natif dans son générateur SQL — `geography` finit
 * entre guillemets et casse la migration. Pour un calcul de distance précis en mètres,
 * caster en géographie dans les requêtes : `location::geography`.
 */
const geographyPoint = customType<{ data: string }>({
  dataType() {
    return 'geometry(Point, 4326)';
  },
});

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const listingTypeEnum = pgEnum('listing_type', [
  'entire_place', // logement entier — réservation bloquante
  'private_room', // chambre privée — réservation bloquante
  'camping_spot', // emplacement camping — places individuelles
  'glamping', // tente équipée — places individuelles
  'couch', // canapé / style couch-surfing — places individuelles
]);

export const listingStatusEnum = pgEnum('listing_status', [
  'draft',
  'pending_review',
  'published',
  'rejected',
  'archived',
]);

export const festivalStatusEnum = pgEnum('festival_status', ['draft', 'published']);

/**
 * Catégories fixes pour le MVP — un festival peut cumuler plusieurs catégories à la fois
 * (ex: événementiel + culturel), voir la colonne `categories` (array) ci-dessous. Remplace
 * l'ancien champ `type` en texte libre (voir festival-categories-setup.md).
 */
export const festivalCategoryEnum = pgEnum('festival_category', [
  'musique',
  'litteraire',
  'evenementiel',
  'culturel',
]);

export const bookingStatusEnum = pgEnum('booking_status', [
  'pending',
  'accepted',
  'rejected',
  'cancelled',
]);

/** Types de logement dont la réservation bloque tout le bien (vs places individuelles). */
export const BLOCKING_LISTING_TYPES = ['entire_place', 'private_room'] as const;

export const userRoleEnum = pgEnum('user_role', ['user', 'admin']);

// ---------------------------------------------------------------------------
// users
// ---------------------------------------------------------------------------

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  fullName: text('full_name'),
  phone: text('phone'),
  avatarUrl: text('avatar_url'),
  bio: text('bio'),
  city: text('city'), // "lieu d'habitation" — non confidentiel, consultable par un hôte lors d'une demande de mise en relation
  birthDate: date('birth_date', { mode: 'date' }), // sert à calculer l'âge affiché à l'hôte, jamais affiché en clair
  role: userRoleEnum('role').notNull().default('user'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const usersRelations = relations(users, ({ many }) => ({
  listings: many(listings, { relationName: 'host_listings' }),
  bookings: many(bookings, { relationName: 'guest_bookings' }),
  reviewsWritten: many(reviews, { relationName: 'review_author' }),
  reviewsReceived: many(reviews, { relationName: 'review_target' }),
}));

// ---------------------------------------------------------------------------
// festivals — créés/curatés par l'admin uniquement
// ---------------------------------------------------------------------------

export const festivals = pgTable('festivals', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  city: text('city').notNull(),
  country: text('country').notNull(), // code ISO (ex: FR, BE, DE)
  location: geographyPoint('location'),
  description: text('description'), // texte libre, optionnel — affiché en haut de la page détail festival
  // Une ou plusieurs catégories fixes (voir festivalCategoryEnum ci-dessus) — un festival peut
  // être à la fois "evenementiel" et "culturel" par exemple.
  categories: festivalCategoryEnum('categories')
    .array()
    .notNull()
    .default(sql`'{}'::festival_category[]`),
  dateStart: timestamp('date_start', { withTimezone: true, mode: 'date' }).notNull(),
  dateEnd: timestamp('date_end', { withTimezone: true, mode: 'date' }).notNull(),
  coverImageUrl: text('cover_image_url'),
  status: festivalStatusEnum('status').notNull().default('draft'),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const festivalsRelations = relations(festivals, ({ many }) => ({
  listingFestivals: many(listingFestivals),
}));

// ---------------------------------------------------------------------------
// listings — fiche générique de l'hôte, indépendante d'un festival précis
// ---------------------------------------------------------------------------

export const listings = pgTable('listings', {
  id: uuid('id').primaryKey().defaultRandom(),
  hostId: uuid('host_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  address: text('address'),
  city: text('city'),
  country: text('country'),
  location: geographyPoint('location'),
  type: listingTypeEnum('type').notNull(),
  // Bornes de capacité — types "bloquants" uniquement (entire_place, private_room). Saisies par
  // l'hôte entre 2 et 10 (validation applicative, voir src/lib/listings/actions.ts) ; minGuests
  // <= maxGuests également vérifié à ce niveau, pas de contrainte SQL dédiée.
  minGuests: integer('min_guests'),
  maxGuests: integer('max_guests'), // capacité — types "bloquants"
  spotsTotal: integer('spots_total'), // nb places — types "à places"
  pricePerNight: numeric('price_per_night', { precision: 10, scale: 2 }), // prix par nuit et par voyageur
  amenities: jsonb('amenities'),
  status: listingStatusEnum('status').notNull().default('draft'),
  submittedAt: timestamp('submitted_at', { withTimezone: true }),
  reviewedBy: uuid('reviewed_by').references(() => users.id, { onDelete: 'set null' }),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  rejectionReason: text('rejection_reason'),
  // Chemin (pas une URL publique) vers un justificatif de domicile fourni par l'hôte
  // (facture EDF, internet...), dans un bucket Storage privé — voir src/lib/listings/storage.ts.
  // Optionnel : le logement peut être créé sans, mais ce champ conditionne uniquement la
  // pastille "hôte certifié" affichée côté application (pas de vérification de contenu par
  // l'admin pour le MVP, cf. dbshema.md §4.8).
  certificationDocumentPath: text('certification_document_path'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const listingsRelations = relations(listings, ({ one, many }) => ({
  host: one(users, {
    fields: [listings.hostId],
    references: [users.id],
    relationName: 'host_listings',
  }),
  photos: many(listingPhotos),
  listingFestivals: many(listingFestivals),
}));

// ---------------------------------------------------------------------------
// listing_photos
// ---------------------------------------------------------------------------

export const listingPhotos = pgTable('listing_photos', {
  id: uuid('id').primaryKey().defaultRandom(),
  listingId: uuid('listing_id')
    .notNull()
    .references(() => listings.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  position: integer('position').notNull().default(0),
});

export const listingPhotosRelations = relations(listingPhotos, ({ one }) => ({
  listing: one(listings, {
    fields: [listingPhotos.listingId],
    references: [listings.id],
  }),
}));

// ---------------------------------------------------------------------------
// listing_festivals — association logement <-> festival (au plus 1 festival par logement)
// ---------------------------------------------------------------------------

export const listingFestivals = pgTable(
  'listing_festivals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    listingId: uuid('listing_id')
      .notNull()
      .references(() => listings.id, { onDelete: 'cascade' }),
    festivalId: uuid('festival_id')
      .notNull()
      .references(() => festivals.id, { onDelete: 'cascade' }),
    priceOverride: numeric('price_override', { precision: 10, scale: 2 }),
    spotsAvailable: integer('spots_available'),
    arrivalBufferBefore: integer('arrival_buffer_before').notNull().default(1),
    arrivalBufferAfter: integer('arrival_buffer_after').notNull().default(1),
    isActive: boolean('is_active').notNull().default(true),
    distanceKm: numeric('distance_km', { precision: 6, scale: 2 }), // distance déclarée par l'hôte, pas de géocodage automatique pour l'instant
    hasShuttle: boolean('has_shuttle').notNull().default(false),
    shuttleCost: numeric('shuttle_cost', { precision: 10, scale: 2 }).notNull().default('0'), // coût supplémentaire, 0 si pas de navette
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  // UNIQUE sur listing_id seul (et non (listing_id, festival_id)) : un logement ne peut
  // apparaître qu'une seule fois dans cette table, donc être associé qu'à un seul festival.
  (table) => [unique('listing_festival_unique').on(table.listingId)]
);

export const listingFestivalsRelations = relations(listingFestivals, ({ one, many }) => ({
  listing: one(listings, {
    fields: [listingFestivals.listingId],
    references: [listings.id],
  }),
  festival: one(festivals, {
    fields: [listingFestivals.festivalId],
    references: [festivals.id],
  }),
  bookings: many(bookings),
}));

// ---------------------------------------------------------------------------
// bookings — dates dérivées du festival (± buffer), validation manuelle hôte
// ---------------------------------------------------------------------------

export const bookings = pgTable('bookings', {
  id: uuid('id').primaryKey().defaultRandom(),
  listingFestivalId: uuid('listing_festival_id')
    .notNull()
    .references(() => listingFestivals.id, { onDelete: 'cascade' }),
  guestId: uuid('guest_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  guestsCount: integer('guests_count').notNull().default(1),
  spotsBooked: integer('spots_booked').notNull().default(1),
  // Renseignées par le festivalier au moment de la demande — validées côté serveur contre la
  // fenêtre festival ± buffer (listingFestivals.arrivalBufferBefore/After), voir requestBookingAction.
  // Nullable : les demandes créées avant l'ajout de ce champ n'en ont pas.
  arrivalDate: date('arrival_date', { mode: 'date' }),
  departureDate: date('departure_date', { mode: 'date' }),
  status: bookingStatusEnum('status').notNull().default('pending'),
  message: text('message'),
  priceAgreed: numeric('price_agreed', { precision: 10, scale: 2 }),
  rejectionReason: text('rejection_reason'), // motif renseigné par l'hôte en cas de refus, consultable par le festivalier
  acceptanceMessage: text('acceptance_message'), // message optionnel de l'hôte à l'acceptation (contact, consignes d'arrivée...), consultable par le festivalier
  // Partage explicite de l'email du festivalier avec l'hôte, une fois la demande acceptée —
  // action volontaire du festivalier (pas automatique), cohérent avec le principe "rien n'est
  // révélé sans un geste explicite du concerné". Voir shareGuestEmailAction.
  guestEmailShared: boolean('guest_email_shared').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  respondedAt: timestamp('responded_at', { withTimezone: true }),
});

/**
 * ⚠️ Invariants NON exprimables en contraintes SQL simples, à appliquer
 * au niveau applicatif (transaction + verrou) lors de la création d'un booking :
 *  - Types "bloquants" (BLOCKING_LISTING_TYPES) : un seul booking `accepted`
 *    actif par `listing_festival_id`.
 *  - Types "à places" : SUM(spots_booked) des bookings `accepted` sur un même
 *    `listing_festival_id` ne doit jamais dépasser `spots_available`
 *    (fallback sur `listings.spots_total` si non défini).
 * Voir /dbshema.md §3.6.
 */
export const bookingsRelations = relations(bookings, ({ one, many }) => ({
  listingFestival: one(listingFestivals, {
    fields: [bookings.listingFestivalId],
    references: [listingFestivals.id],
  }),
  guest: one(users, {
    fields: [bookings.guestId],
    references: [users.id],
    relationName: 'guest_bookings',
  }),
  reviews: many(reviews),
}));

// ---------------------------------------------------------------------------
// reviews — bidirectionnel, post-séjour
// ---------------------------------------------------------------------------

export const reviews = pgTable(
  'reviews',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    bookingId: uuid('booking_id')
      .notNull()
      .references(() => bookings.id, { onDelete: 'cascade' }),
    authorId: uuid('author_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    targetId: uuid('target_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    rating: integer('rating').notNull(),
    comment: text('comment'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('review_booking_author_unique').on(table.bookingId, table.authorId),
    check('rating_range', sql`${table.rating} >= 1 AND ${table.rating} <= 5`),
  ]
);

export const reviewsRelations = relations(reviews, ({ one }) => ({
  booking: one(bookings, {
    fields: [reviews.bookingId],
    references: [bookings.id],
  }),
  author: one(users, {
    fields: [reviews.authorId],
    references: [users.id],
    relationName: 'review_author',
  }),
  target: one(users, {
    fields: [reviews.targetId],
    references: [users.id],
    relationName: 'review_target',
  }),
}));

// ---------------------------------------------------------------------------
// contact_messages — formulaire de contact public, pas de compte requis
// ---------------------------------------------------------------------------

export const contactMessages = pgTable('contact_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  message: text('message').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
