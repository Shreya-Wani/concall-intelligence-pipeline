import { asc } from 'drizzle-orm';
import { Router } from 'express';
import { db } from '../db';
import { companies } from '../db/schema';

const router = Router();

// GET /api/companies
router.get('/companies', async (_req, res, next) => {
  try {
    const list = await db
      .select({
        id: companies.id,
        name: companies.name,
        nseSymbol: companies.nseSymbol,
        bseCode: companies.bseCode,
        isin: companies.isin,
        sector: companies.sector,
        createdAt: companies.createdAt,
      })
      .from(companies)
      .orderBy(asc(companies.name));

    return res.json({
      data: list,
    });
  } catch (err) {
    return next(err);
  }
});

export default router;
