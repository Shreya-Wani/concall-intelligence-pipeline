import { eq } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { companies, filings, summaries, transcripts } from '../db/schema';

const router = Router();

const uuidParamSchema = z.string().uuid();

// GET /api/filings/:id
router.get('/filings/:id', async (req, res, next) => {
  try {
    const parseResult = uuidParamSchema.safeParse(req.params.id);
    if (!parseResult.success) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Filing not found',
        },
      });
    }

    const filingId = parseResult.data;

    const record = await db
      .select({
        filing: filings,
        company: companies,
      })
      .from(filings)
      .innerJoin(companies, eq(filings.companyId, companies.id))
      .where(eq(filings.id, filingId))
      .limit(1);

    if (record.length === 0) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Filing not found',
        },
      });
    }

    const { filing, company } = record[0];

    // Query optional transcript metadata
    const transcriptRecord = await db
      .select({
        id: transcripts.id,
        characterCount: transcripts.characterCount,
        pageCount: transcripts.pageCount,
        extractionMethod: transcripts.extractionMethod,
        createdAt: transcripts.createdAt,
      })
      .from(transcripts)
      .where(eq(transcripts.filingId, filing.id))
      .limit(1);

    // Query optional summary metadata
    let summaryMetadata = null;
    if (transcriptRecord.length > 0) {
      const summaryRecord = await db
        .select({
          id: summaries.id,
          model: summaries.model,
          promptVersion: summaries.promptVersion,
          createdAt: summaries.createdAt,
        })
        .from(summaries)
        .where(eq(summaries.transcriptId, transcriptRecord[0].id))
        .limit(1);

      if (summaryRecord.length > 0) {
        summaryMetadata = summaryRecord[0];
      }
    }

    return res.json({
      data: {
        id: filing.id,
        company: {
          id: company.id,
          name: company.name,
          nseSymbol: company.nseSymbol,
          bseCode: company.bseCode,
          sector: company.sector,
        },
        source: filing.source,
        sourceAnnouncementId: filing.sourceAnnouncementId,
        filingDate: filing.filingDate,
        eventType: filing.eventType,
        subject: filing.subject,
        sourceUrl: filing.sourceUrl,
        status: filing.status,
        createdAt: filing.createdAt,
        updatedAt: filing.updatedAt,
        transcript: transcriptRecord.length > 0 ? transcriptRecord[0] : null,
        summary: summaryMetadata,
      },
    });
  } catch (err) {
    return next(err);
  }
});

export default router;
