import { db, queryClient } from './index';
import { companies } from './schema';

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
  console.log('\ud83c\udf31 Starting database seeding...');

  for (const company of seedCompanies) {
    await db.insert(companies).values(company).onConflictDoNothing();
    console.log(`  \u2713 Inserted/verified company: ${company.name} (${company.nseSymbol})`);
  }

  console.log('\u2705 Database seeding completed. Companies seeded, no fake transcripts or summaries.');
  await queryClient.end();
}

if (require.main === module) {
  seed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('\u274c Seeding failed:', err);
      process.exit(1);
    });
}