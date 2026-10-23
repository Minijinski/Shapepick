CREATE TYPE "public"."ball_position" AS ENUM('thumb', 'finger');--> statement-breakpoint
CREATE TYPE "public"."grip" AS ENUM('palm', 'claw', 'fingertip');--> statement-breakpoint
CREATE TYPE "public"."mouse_hand" AS ENUM('right', 'left', 'ambidextrous');--> statement-breakpoint
CREATE TYPE "public"."mouse_power" AS ENUM('rechargeable', 'aa', 'aaa');--> statement-breakpoint
CREATE TYPE "public"."mouse_segment" AS ENUM('gaming', 'office');--> statement-breakpoint
CREATE TYPE "public"."mouse_shape" AS ENUM('symmetrical', 'ergonomic', 'vertical', 'trackball');--> statement-breakpoint
CREATE TYPE "public"."mouse_switch_type" AS ENUM('mechanical', 'optical', 'hybrid', 'magnetic');--> statement-breakpoint
ALTER TYPE "public"."category" ADD VALUE 'mouse';--> statement-breakpoint
CREATE TABLE "mouse_specs" (
	"product_id" integer PRIMARY KEY NOT NULL,
	"shape" "mouse_shape" NOT NULL,
	"hand" "mouse_hand" NOT NULL,
	"segment" "mouse_segment" NOT NULL,
	"length_mm" real,
	"width_mm" real,
	"height_mm" real,
	"weight_g" real,
	"ball_position" "ball_position",
	"buttons" smallint,
	"mmo" boolean DEFAULT false NOT NULL,
	"sensor" text,
	"dpi_max" integer,
	"polling_hz" integer,
	"switch_type" "mouse_switch_type",
	"silent_clicks" boolean DEFAULT false NOT NULL,
	"conn_wired" boolean DEFAULT true NOT NULL,
	"conn24ghz" boolean DEFAULT false NOT NULL,
	"conn_bt" boolean DEFAULT false NOT NULL,
	"hosts" smallint DEFAULT 1 NOT NULL,
	"battery_hours" real,
	"power" "mouse_power",
	"wireless_charging" boolean DEFAULT false NOT NULL,
	"free_spin_wheel" boolean DEFAULT false NOT NULL,
	"tilt_wheel" boolean DEFAULT false NOT NULL,
	"thumb_wheel" boolean DEFAULT false NOT NULL,
	"rgb" boolean DEFAULT false NOT NULL,
	"maker_hand_min_cm" real,
	"maker_hand_max_cm" real,
	"maker_grips" "grip"[],
	"extra" jsonb
);
--> statement-breakpoint
ALTER TABLE "mouse_specs" ADD CONSTRAINT "mouse_specs_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;