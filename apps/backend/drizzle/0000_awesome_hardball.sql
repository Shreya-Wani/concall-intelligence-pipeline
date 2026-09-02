CREATE TYPE "public"."filing_source" AS ENUM('NSE', 'BSE');--> statement-breakpoint
CREATE TYPE "public"."filing_status" AS ENUM('DISCOVERED', 'DOWNLOADING', 'DOWNLOADED', 'EXTRACTING', 'EXTRACTED', 'SUMMARIZING', 'COMPLETED', 'FAILED');--> statement-breakpoint
CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"nse_symbol" text,
	"bse_code" text,
	"isin" text,
	"sector" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "companies_nse_symbol_unique" UNIQUE("nse_symbol"),
	CONSTRAINT "companies_bse_code_unique" UNIQUE("bse_code"),
	CONSTRAINT "companies_isin_unique" UNIQUE("isin")
);
--> statement-breakpoint
CREATE TABLE "filings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"source" "filing_source" NOT NULL,
	"source_announcement_id" text,
	"filing_date" timestamp NOT NULL,
	"event_type" text,
	"subject" text,
	"quarter" text,
	"call_date" timestamp,
	"source_url" text,
	"pdf_url" text,
	"pdf_hash" text,
	"status" "filing_status" DEFAULT 'DISCOVERED' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "summaries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transcript_id" uuid NOT NULL,
	"model" text NOT NULL,
	"prompt_version" text NOT NULL,
	"summary_json" jsonb NOT NULL,
	"summary_markdown" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "summaries_transcript_id_unique" UNIQUE("transcript_id")
);
--> statement-breakpoint
CREATE TABLE "transcripts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"filing_id" uuid NOT NULL,
	"text" text NOT NULL,
	"character_count" integer NOT NULL,
	"page_count" integer,
	"extraction_method" text NOT NULL,
	"extraction_metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "transcripts_filing_id_unique" UNIQUE("filing_id")
);
--> statement-breakpoint
ALTER TABLE "filings" ADD CONSTRAINT "filings_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "summaries" ADD CONSTRAINT "summaries_transcript_id_transcripts_id_fk" FOREIGN KEY ("transcript_id") REFERENCES "public"."transcripts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transcripts" ADD CONSTRAINT "transcripts_filing_id_filings_id_fk" FOREIGN KEY ("filing_id") REFERENCES "public"."filings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "source_announcement_idx" ON "filings" USING btree ("source","source_announcement_id");--> statement-breakpoint
CREATE INDEX "company_id_idx" ON "filings" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "filing_date_idx" ON "filings" USING btree ("filing_date");--> statement-breakpoint
CREATE INDEX "source_idx" ON "filings" USING btree ("source");--> statement-breakpoint
CREATE INDEX "status_idx" ON "filings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "pdf_hash_idx" ON "filings" USING btree ("pdf_hash");--> statement-breakpoint
CREATE INDEX "quarter_idx" ON "filings" USING btree ("quarter");--> statement-breakpoint
CREATE INDEX "call_date_idx" ON "filings" USING btree ("call_date");