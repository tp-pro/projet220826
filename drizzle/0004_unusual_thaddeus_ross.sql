ALTER TABLE "listing_festivals" DROP CONSTRAINT "listing_festival_unique";--> statement-breakpoint
ALTER TABLE "listing_festivals" ADD CONSTRAINT "listing_festival_unique" UNIQUE("listing_id");