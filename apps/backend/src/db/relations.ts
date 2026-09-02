import { relations } from 'drizzle-orm';
import { companies, filings, summaries, transcripts } from './schema';

export const companiesRelations = relations(companies, ({ many }) => ({
  filings: many(filings),
}));

export const filingsRelations = relations(filings, ({ one }) => ({
  company: one(companies, {
    fields: [filings.companyId],
    references: [companies.id],
  }),
  transcript: one(transcripts, {
    fields: [filings.id],
    references: [transcripts.filingId],
  }),
}));

export const transcriptsRelations = relations(transcripts, ({ one }) => ({
  filing: one(filings, {
    fields: [transcripts.filingId],
    references: [filings.id],
  }),
  summary: one(summaries, {
    fields: [transcripts.id],
    references: [summaries.transcriptId],
  }),
}));

export const summariesRelations = relations(summaries, ({ one }) => ({
  transcript: one(transcripts, {
    fields: [summaries.transcriptId],
    references: [transcripts.id],
  }),
}));
