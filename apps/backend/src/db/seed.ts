import fs from 'fs';
import path from 'path';
import { db, queryClient } from './index';
import { companies, filings, summaries, transcripts } from './schema';

import { eq } from 'drizzle-orm';

export const seedCompanies = [
  {
    name: 'Tata Consultancy Services Limited',
    nseSymbol: 'TCS',
    bseCode: '532540',
    isin: 'INE467B01029',
    sector: 'Information Technology',
  },
  {
    name: 'Tata Motors Limited',
    nseSymbol: 'TATAMOTORS',
    bseCode: '500570',
    isin: 'INE155A01022',
    sector: 'Automobile',
  },
  {
    name: 'Sun Pharmaceutical Industries Limited',
    nseSymbol: 'SUNPHARMA',
    bseCode: '524715',
    isin: 'INE044A01036',
    sector: 'Pharmaceuticals',
  },
  {
    name: 'Infosys Limited',
    nseSymbol: 'INFY',
    bseCode: '500209',
    isin: 'INE009A01021',
    sector: 'Information Technology',
  },
  {
    name: 'HDFC Bank Limited',
    nseSymbol: 'HDFCBANK',
    bseCode: '500180',
    isin: 'INE040A01034',
    sector: 'Banking & Financial Services',
  },
];

export async function seed() {
  console.log('🌱 Starting real PostgreSQL database seeding...');

  for (const company of seedCompanies) {
    await db.insert(companies).values(company).onConflictDoNothing();
    console.log(`  ✓ Inserted/verified company: ${company.name} (${company.nseSymbol})`);
  }

  const summariesDir = path.resolve(__dirname, '../../../data/summaries');
  const files = [
    { json: 'INFY_Q1_FY25_Summary.json', md: 'INFY_Q1_FY25_Summary.md', nse: 'INFY' },
    { json: 'TCS_Q1_FY25_Summary.json', md: 'TCS_Q1_FY25_Summary.md', nse: 'TCS' },
    { json: 'SUNPHARMA_Q1_FY25_Summary.json', md: 'SUNPHARMA_Q1_FY25_Summary.md', nse: 'SUNPHARMA' },
  ];

  for (const f of files) {
    const jsonPath = path.join(summariesDir, f.json);
    const mdPath = path.join(summariesDir, f.md);

    if (fs.existsSync(jsonPath) && fs.existsSync(mdPath)) {
      const summaryJson = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      const summaryMarkdown = fs.readFileSync(mdPath, 'utf8');

      const companyRec = await db.select().from(companies).where(eq(companies.nseSymbol, f.nse));
      if (companyRec.length > 0) {
        const companyId = companyRec[0].id;

        // Check or create filing
        let filingId: string;
        const existingFiling = await db.select().from(filings).where(eq(filings.companyId, companyId)).limit(1);
        if (existingFiling.length > 0) {
          filingId = existingFiling[0].id;
        } else {
          const insertedFiling = await db
            .insert(filings)
            .values({
              companyId,
              source: summaryJson.source || 'NSE',
              sourceAnnouncementId: `SEED-${f.nse}-Q1FY25`,
              filingDate: new Date('2024-07-18'),
              eventType: 'Transcript Intimation',
              subject: `${summaryJson.company} Earnings Call Transcript ${summaryJson.quarter}`,
              status: 'COMPLETED',
            })
            .returning({ id: filings.id });
          filingId = insertedFiling[0].id;
        }

        // Check or create transcript
        let transcriptId: string;
        const existingTranscript = await db.select().from(transcripts).where(eq(transcripts.filingId, filingId)).limit(1);
        if (existingTranscript.length > 0) {
          transcriptId = existingTranscript[0].id;
        } else {
          const insertedTranscript = await db
            .insert(transcripts)
            .values({
              filingId,
              text: summaryMarkdown,
              characterCount: summaryMarkdown.length,
              pageCount: 25,
              extractionMethod: 'pdf_text',
            })
            .returning({ id: transcripts.id });
          transcriptId = insertedTranscript[0].id;
        }

        // Delete existing summary for this transcript if any
        await db.delete(summaries).where(eq(summaries.transcriptId, transcriptId));
        await db.insert(summaries).values({
          transcriptId,
          model: 'groq',
          promptVersion: 'v1.0',
          summaryJson,
          summaryMarkdown,
        });
        console.log(`  ✓ Seeded summary for ${summaryJson.company} (${f.nse})`);
      }
    }
  }

  console.log('✅ Real PostgreSQL seeding completed successfully.');
  await queryClient.end();
}


if (require.main === module) {
  seed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Seeding failed:', err);
      process.exit(1);
    });
}

