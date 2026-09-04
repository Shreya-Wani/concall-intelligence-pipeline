import { and, count, desc, eq } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { companies, filings, summaries, transcripts } from '../db/schema';

const router = Router();

const summaryQuerySchema = z.object({
  companyId: z.string().uuid().optional(),
  source: z.enum(['NSE', 'BSE']).optional(),
  quarter: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

const uuidParamSchema = z.string().uuid();

router.get('/summaries', async (req, res, next) => {
  try {
    const parseResult = summaryQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
      return res.status(400).json({
        error: { code: 'BAD_REQUEST', message: 'Invalid query parameters', details: parseResult.error.format() },
      });
    }

    const { companyId, source, quarter, limit, offset } = parseResult.data;

    const conditions = [];
    if (companyId) conditions.push(eq(companies.id, companyId));
    if (source) conditions.push(eq(filings.source, source));
    if (quarter) conditions.push(eq(filings.quarter, quarter));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const countRes = await db
      .select({ total: count() })
      .from(summaries)
      .innerJoin(transcripts, eq(summaries.transcriptId, transcripts.id))
      .innerJoin(filings, eq(transcripts.filingId, filings.id))
      .innerJoin(companies, eq(filings.companyId, companies.id))
      .where(whereClause);

    const total = countRes[0]?.total || 0;

    const rows = await db
      .select({
        summary: summaries,
        transcript: transcripts,
        filing: filings,
        company: companies,
      })
      .from(summaries)
      .innerJoin(transcripts, eq(summaries.transcriptId, transcripts.id))
      .innerJoin(filings, eq(transcripts.filingId, filings.id))
      .innerJoin(companies, eq(filings.companyId, companies.id))
      .where(whereClause)
      .orderBy(desc(summaries.createdAt))
      .limit(limit)
      .offset(offset);

    const items = rows.map((r) => {
      const summaryContent = r.summary.summaryJson as any;
      return {
        id: r.summary.id,
        company: {
          id: r.company.id,
          name: r.company.name,
          nseSymbol: r.company.nseSymbol,
          bseCode: r.company.bseCode,
          sector: r.company.sector,
        },
        quarter: summaryContent?.quarter ?? r.filing.quarter ?? null,
        quarterInferred: summaryContent?.quarter_inferred ?? false,
        callDate: summaryContent?.call_date ?? null,
        source: r.filing.source,
        sourceUrl: r.filing.sourceUrl,
        model: r.summary.model,
        createdAt: r.summary.createdAt,
        summaryJson: r.summary.summaryJson,
        summaryMarkdown: r.summary.summaryMarkdown,
      };
    });

    return res.json({ items, pagination: { limit, offset, total } });
  } catch (err) {
    return next(err);
  }
});

router.get('/summaries/:id', async (req, res, next) => {
  try {
    const parseResult = uuidParamSchema.safeParse(req.params.id);
    if (!parseResult.success) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Summary not found' } });
    }

    const summaryId = parseResult.data;

    const rows = await db
      .select({ summary: summaries, transcript: transcripts, filing: filings, company: companies })
      .from(summaries)
      .innerJoin(transcripts, eq(summaries.transcriptId, transcripts.id))
      .innerJoin(filings, eq(transcripts.filingId, filings.id))
      .innerJoin(companies, eq(filings.companyId, companies.id))
      .where(eq(summaries.id, summaryId))
      .limit(1);

    if (rows.length === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Summary not found' } });
    }

    const r = rows[0];
    const summaryContent = r.summary.summaryJson as any;

    return res.json({
      data: {
        id: r.summary.id,
        company: {
          id: r.company.id,
          name: r.company.name,
          nseSymbol: r.company.nseSymbol,
          bseCode: r.company.bseCode,
          isin: r.company.isin,
          sector: r.company.sector,
        },
        quarter: summaryContent?.quarter ?? r.filing.quarter ?? null,
        quarterInferred: summaryContent?.quarter_inferred ?? false,
        callDate: summaryContent?.call_date ?? null,
        source: r.filing.source,
        sourceAnnouncementId: r.filing.sourceAnnouncementId,
        sourceUrl: r.filing.sourceUrl,
        model: r.summary.model,
        promptVersion: r.summary.promptVersion,
        createdAt: r.summary.createdAt,
        summaryJson: r.summary.summaryJson,
        summaryMarkdown: r.summary.summaryMarkdown,
        transcript: {
          id: r.transcript.id,
          characterCount: r.transcript.characterCount,
          pageCount: r.transcript.pageCount,
          extractionMethod: r.transcript.extractionMethod,
        },
      },
    });
  } catch (err) {
    return next(err);
  }
});

export default router;
