import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

// Enums
export const filingSourceEnum = pgEnum('filing_source', ['NSE', 'BSE']);

export const filingStatusEnum = pgEnum('filing_status', [
  'DISCOVERED',
  'DOWNLOADING',
  'DOWNLOADED',
  'EXTRACTING',
  'EXTRACTED',
  'SUMMARIZING',
  'COMPLETED',
  'FAILED',
]);

// 1. Companies Table
export const companies = pgTable('companies', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  nseSymbol: text('nse_symbol').unique(),
  bseCode: text('bse_code').unique(),
  isin: text('isin').unique(),
  sector: text('sector'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 2. Filings Table
export const filings = pgTable(
  'filings',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    source: filingSourceEnum('source').notNull(),
    sourceAnnouncementId: text('source_announcement_id'),
    filingDate: timestamp('filing_date').notNull(),
    eventType: text('event_type'),
    subject: text('subject'),
    quarter: text('quarter'),
    callDate: timestamp('call_date'),
    sourceUrl: text('source_url'),
    pdfUrl: text('pdf_url'),
    pdfHash: text('pdf_hash'),
    status: filingStatusEnum('status').default('DISCOVERED').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('source_announcement_idx').on(table.source, table.sourceAnnouncementId),
    index('company_id_idx').on(table.companyId),
    index('filing_date_idx').on(table.filingDate),
    index('source_idx').on(table.source),
    index('status_idx').on(table.status),
    index('pdf_hash_idx').on(table.pdfHash),
    index('quarter_idx').on(table.quarter),
    index('call_date_idx').on(table.callDate),
  ]
);

// 3. Transcripts Table
export const transcripts = pgTable('transcripts', {
  id: uuid('id').defaultRandom().primaryKey(),
  filingId: uuid('filing_id')
    .notNull()
    .unique()
    .references(() => filings.id, { onDelete: 'cascade' }),
  text: text('text').notNull(),
  characterCount: integer('character_count').notNull(),
  pageCount: integer('page_count'),
  extractionMethod: text('extraction_method').notNull(),
  extractionMetadata: jsonb('extraction_metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 4. Summaries Table
export const summaries = pgTable('summaries', {
  id: uuid('id').defaultRandom().primaryKey(),
  transcriptId: uuid('transcript_id')
    .notNull()
    .unique()
    .references(() => transcripts.id, { onDelete: 'cascade' }),
  model: text('model').notNull(),
  promptVersion: text('prompt_version').notNull(),
  summaryJson: jsonb('summary_json').notNull(),
  summaryMarkdown: text('summary_markdown').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
