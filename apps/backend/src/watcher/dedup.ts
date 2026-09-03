import { eq, and } from 'drizzle-orm';
import { db } from '../db';
import { filings } from '../db/schema';
import { FilingSource } from './types';

export async function isLevel1Duplicate(source: FilingSource, sourceAnnouncementId: string): Promise<boolean> {
  const existing = await db
    .select({ id: filings.id })
    .from(filings)
    .where(and(eq(filings.source, source), eq(filings.sourceAnnouncementId, sourceAnnouncementId)))
    .limit(1);

  return existing.length > 0;
}

export async function findFilingByPdfHash(pdfHash: string): Promise<{ id: string; pdfUrl: string | null } | null> {
  const existing = await db
    .select({ id: filings.id, pdfUrl: filings.pdfUrl })
    .from(filings)
    .where(eq(filings.pdfHash, pdfHash))
    .limit(1);

  if (existing.length > 0) {
    return existing[0];
  }
  return null;
}
