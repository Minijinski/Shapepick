ALTER TABLE "switches" ALTER COLUMN "actuation_force_g" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "switches" ALTER COLUMN "pre_travel_mm" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "switches" ALTER COLUMN "total_travel_mm" DROP NOT NULL;