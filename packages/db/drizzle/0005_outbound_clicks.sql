CREATE TABLE "outbound_clicks" (
	"id" serial PRIMARY KEY NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"shop" text NOT NULL,
	"product_slug" text NOT NULL,
	"category" "category" NOT NULL,
	"placement" text NOT NULL,
	"link" text NOT NULL,
	"locale" text NOT NULL,
	"page" text,
	"country" text,
	"device" text
);
--> statement-breakpoint
CREATE INDEX "outbound_clicks_at_index" ON "outbound_clicks" USING btree ("at");--> statement-breakpoint
CREATE INDEX "outbound_clicks_product_slug_index" ON "outbound_clicks" USING btree ("product_slug");