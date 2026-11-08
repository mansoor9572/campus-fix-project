ALTER TABLE "buildings" ALTER COLUMN "code" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "buildings" ADD COLUMN "directory_key" text;--> statement-breakpoint
ALTER TABLE "buildings" ADD COLUMN "indonesian_name" text;--> statement-breakpoint
ALTER TABLE "buildings" ADD COLUMN "aliases" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "buildings" ADD COLUMN "faculty" text;--> statement-breakpoint
ALTER TABLE "buildings" ADD COLUMN "building_type" text;--> statement-breakpoint
ALTER TABLE "buildings" ADD COLUMN "maps_url" text;--> statement-breakpoint
ALTER TABLE "buildings" ADD COLUMN "latitude" real;--> statement-breakpoint
ALTER TABLE "buildings" ADD COLUMN "longitude" real;--> statement-breakpoint
ALTER TABLE "buildings" ADD COLUMN "verification_status" text DEFAULT 'unverified' NOT NULL;--> statement-breakpoint
ALTER TABLE "buildings" ADD COLUMN "source_url" text;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "floor" text;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "room_number" text;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "additional_details" text;--> statement-breakpoint
CREATE UNIQUE INDEX "buildings_directory_key_idx" ON "buildings" USING btree ("directory_key");--> statement-breakpoint
CREATE INDEX "buildings_name_idx" ON "buildings" USING btree ("name");