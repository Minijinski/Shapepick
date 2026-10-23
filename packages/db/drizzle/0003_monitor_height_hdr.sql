ALTER TYPE "public"."hdr_cert" ADD VALUE 'true_black_600';--> statement-breakpoint
ALTER TABLE "monitor_specs" ADD COLUMN "height_adjustable" boolean DEFAULT false NOT NULL;