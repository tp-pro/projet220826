ALTER TABLE "listing_festivals" ADD COLUMN "distance_km" numeric(6, 2);--> statement-breakpoint
ALTER TABLE "listing_festivals" ADD COLUMN "has_shuttle" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "listing_festivals" ADD COLUMN "shuttle_cost" numeric(10, 2) DEFAULT '0' NOT NULL;