CREATE TABLE "catalog_snapshots" (
	"category" "category" PRIMARY KEY NOT NULL,
	"version" text NOT NULL,
	"updated_at" timestamp with time zone,
	"rows" jsonb NOT NULL,
	"written_at" timestamp with time zone DEFAULT now() NOT NULL
);
