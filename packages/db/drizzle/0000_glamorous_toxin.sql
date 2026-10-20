CREATE TYPE "public"."aspect" AS ENUM('16:9', '16:10', '21:9', '32:9', '3:2');--> statement-breakpoint
CREATE TYPE "public"."backlight" AS ENUM('none', 'white', 'rgb');--> statement-breakpoint
CREATE TYPE "public"."case_material" AS ENUM('plastic', 'aluminum', 'polycarbonate', 'wood', 'steel');--> statement-breakpoint
CREATE TYPE "public"."category" AS ENUM('keyboard', 'monitor');--> statement-breakpoint
CREATE TYPE "public"."coating" AS ENUM('matte', 'semi', 'glossy');--> statement-breakpoint
CREATE TYPE "public"."color_family" AS ENUM('black', 'white', 'color', 'transparent');--> statement-breakpoint
CREATE TYPE "public"."dp_version" AS ENUM('1.2', '1.4', '2.1');--> statement-breakpoint
CREATE TYPE "public"."firmware" AS ENUM('qmk', 'via', 'vial', 'zmk', 'proprietary');--> statement-breakpoint
CREATE TYPE "public"."form_factor" AS ENUM('full', 'f96', 'tkl', 'f75', 'f65', 'f60', 'f40', 'split', 'alice', 'numpad');--> statement-breakpoint
CREATE TYPE "public"."hdmi_version" AS ENUM('1.4', '2.0', '2.1');--> statement-breakpoint
CREATE TYPE "public"."hdr_cert" AS ENUM('none', 'hdr400', 'hdr500', 'hdr600', 'hdr1000', 'hdr1400', 'true_black_400', 'true_black_500');--> statement-breakpoint
CREATE TYPE "public"."hot_swap" AS ENUM('none', '3pin', '5pin', 'magnetic');--> statement-breakpoint
CREATE TYPE "public"."image_kind" AS ENUM('cutout_top', 'cutout_front', 'three_quarter', 'lifestyle');--> statement-breakpoint
CREATE TYPE "public"."keyboard_layout" AS ENUM('ansi_us', 'iso_fr', 'iso_uk', 'iso_de', 'iso_nordic', 'jis');--> statement-breakpoint
CREATE TYPE "public"."keyboard_technology" AS ENUM('mechanical', 'magnetic', 'optical', 'membrane', 'scissor', 'topre');--> statement-breakpoint
CREATE TYPE "public"."keycap_material" AS ENUM('abs', 'pbt', 'pom');--> statement-breakpoint
CREATE TYPE "public"."keycap_profile" AS ENUM('cherry', 'oem', 'sa', 'xda', 'mda', 'ksa', 'low');--> statement-breakpoint
CREATE TYPE "public"."mount" AS ENUM('tray', 'gasket', 'top', 'sandwich', 'plateless', 'integrated');--> statement-breakpoint
CREATE TYPE "public"."panel" AS ENUM('ips', 'va', 'tn', 'woled', 'qdoled', 'miniled_ips', 'miniled_va');--> statement-breakpoint
CREATE TYPE "public"."plate_material" AS ENUM('steel', 'aluminum', 'brass', 'fr4', 'polycarbonate', 'pom');--> statement-breakpoint
CREATE TYPE "public"."product_status" AS ENUM('active', 'discontinued');--> statement-breakpoint
CREATE TYPE "public"."sound_profile" AS ENUM('deep', 'clacky', 'muted', 'poppy', 'crisp');--> statement-breakpoint
CREATE TYPE "public"."switch_feel" AS ENUM('linear', 'tactile', 'clicky');--> statement-breakpoint
CREATE TYPE "public"."switch_tech" AS ENUM('mechanical', 'magnetic', 'optical');--> statement-breakpoint
CREATE TYPE "public"."vrr" AS ENUM('none', 'freesync', 'freesync_premium', 'freesync_premium_pro', 'gsync_compatible', 'gsync_module');--> statement-breakpoint
CREATE TABLE "brands" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"country" text,
	"website" text,
	CONSTRAINT "brands_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "keyboard_specs" (
	"product_id" integer PRIMARY KEY NOT NULL,
	"form_factor" "form_factor" NOT NULL,
	"technology" "keyboard_technology" NOT NULL,
	"low_profile" boolean DEFAULT false NOT NULL,
	"hot_swap" "hot_swap" DEFAULT 'none' NOT NULL,
	"conn_wired" boolean DEFAULT true NOT NULL,
	"conn24ghz" boolean DEFAULT false NOT NULL,
	"conn_bt" boolean DEFAULT false NOT NULL,
	"bt_devices" smallint,
	"polling_hz_wired" integer,
	"polling_hz_wireless" integer,
	"rapid_trigger" boolean DEFAULT false NOT NULL,
	"adjustable_actuation" boolean DEFAULT false NOT NULL,
	"min_actuation_mm" real,
	"mount" "mount",
	"case_material" "case_material" DEFAULT 'plastic' NOT NULL,
	"plate_material" "plate_material",
	"keycap_material" "keycap_material" DEFAULT 'abs' NOT NULL,
	"keycap_profile" "keycap_profile",
	"backlight" "backlight" DEFAULT 'none' NOT NULL,
	"south_facing" boolean DEFAULT false NOT NULL,
	"knob" boolean DEFAULT false NOT NULL,
	"screen" boolean DEFAULT false NOT NULL,
	"firmware" "firmware" DEFAULT 'proprietary' NOT NULL,
	"mac_support" boolean DEFAULT false NOT NULL,
	"battery_mah" integer,
	"wrist_rest_included" boolean DEFAULT false NOT NULL,
	"sound_dampening" boolean DEFAULT false NOT NULL,
	"weight_g" integer,
	"width_mm" integer,
	"depth_mm" integer,
	"height_front_mm" real,
	"typing_angle_deg" real,
	"extra" jsonb
);
--> statement-breakpoint
CREATE TABLE "monitor_specs" (
	"product_id" integer PRIMARY KEY NOT NULL,
	"diagonal_in" real NOT NULL,
	"aspect" "aspect" NOT NULL,
	"res_w" integer NOT NULL,
	"res_h" integer NOT NULL,
	"ppi" double precision GENERATED ALWAYS AS (round(sqrt(res_w::float8 * res_w + res_h::float8 * res_h) / diagonal_in)) STORED,
	"panel" "panel" NOT NULL,
	"dimming_zones" integer,
	"curvature_r" integer,
	"coating" "coating" DEFAULT 'matte' NOT NULL,
	"refresh_hz_max" integer NOT NULL,
	"dual_mode_hz" integer,
	"response_gtg_ms" real,
	"vrr" "vrr" DEFAULT 'none' NOT NULL,
	"hdr_cert" "hdr_cert" DEFAULT 'none' NOT NULL,
	"brightness_sdr_nits" integer,
	"brightness_hdr_peak_nits" integer,
	"contrast_static" integer,
	"dci_p_3_pct" real,
	"srgb_pct" real,
	"bit_depth" smallint,
	"factory_calibrated" boolean DEFAULT false NOT NULL,
	"hdmi_ports" smallint DEFAULT 1 NOT NULL,
	"hdmi_version" "hdmi_version",
	"dp_version" "dp_version",
	"usbc_pd_w" integer DEFAULT 0 NOT NULL,
	"thunderbolt" boolean DEFAULT false NOT NULL,
	"kvm" boolean DEFAULT false NOT NULL,
	"usb_hub" boolean DEFAULT false NOT NULL,
	"speakers" boolean DEFAULT false NOT NULL,
	"stand_height_mm" integer DEFAULT 0 NOT NULL,
	"tilt" boolean DEFAULT true NOT NULL,
	"swivel" boolean DEFAULT false NOT NULL,
	"pivot" boolean DEFAULT false NOT NULL,
	"vesa" boolean DEFAULT true NOT NULL,
	"weight_g" integer,
	"extra" jsonb
);
--> statement-breakpoint
CREATE TABLE "offers" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"variant_id" integer,
	"shop" text NOT NULL,
	"country" text NOT NULL,
	"url" text NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"in_stock" boolean DEFAULT true NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_images" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"url" text NOT NULL,
	"kind" "image_kind" NOT NULL,
	"width" integer,
	"height" integer,
	"dominant_hex" text,
	"is_primary" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_translations" (
	"product_id" integer NOT NULL,
	"locale" text NOT NULL,
	"tagline" text,
	"description" text,
	"seo_title" text,
	"seo_description" text,
	CONSTRAINT "product_translations_product_id_locale_pk" PRIMARY KEY("product_id","locale")
);
--> statement-breakpoint
CREATE TABLE "product_variants" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"sku" text,
	"color_name" text NOT NULL,
	"color_family" "color_family" NOT NULL,
	"layout" "keyboard_layout",
	"switch_id" integer,
	"msrp_eur" numeric(10, 2)
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"category" "category" NOT NULL,
	"brand_id" integer NOT NULL,
	"name" text NOT NULL,
	"model_number" text,
	"release_year" smallint,
	"status" "product_status" DEFAULT 'active' NOT NULL,
	"msrp_eur" numeric(10, 2) NOT NULL,
	"msrp_usd" numeric(10, 2),
	"popularity" real DEFAULT 0.5 NOT NULL,
	"editorial_score" real DEFAULT 0.5 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "switches" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"brand" text NOT NULL,
	"name" text NOT NULL,
	"feel" "switch_feel" NOT NULL,
	"silent" boolean DEFAULT false NOT NULL,
	"tech" "switch_tech" NOT NULL,
	"actuation_force_g" real NOT NULL,
	"bottom_out_g" real,
	"pre_travel_mm" real NOT NULL,
	"total_travel_mm" real NOT NULL,
	"factory_lubed" boolean DEFAULT false NOT NULL,
	"sound_profile" "sound_profile",
	CONSTRAINT "switches_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "keyboard_specs" ADD CONSTRAINT "keyboard_specs_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monitor_specs" ADD CONSTRAINT "monitor_specs_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_translations" ADD CONSTRAINT "product_translations_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_switch_id_switches_id_fk" FOREIGN KEY ("switch_id") REFERENCES "public"."switches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "offers_product_id_shop_country_url_index" ON "offers" USING btree ("product_id","shop","country","url");--> statement-breakpoint
CREATE INDEX "product_variants_product_id_index" ON "product_variants" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "products_category_status_index" ON "products" USING btree ("category","status");