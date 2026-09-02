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
];

export async function seed() {
  console.log('🌱 Starting real PostgreSQL database seeding...');

  for (const company of seedCompanies) {
    await db.insert(companies).values(company).onConflictDoNothing();
    console.log(`  ✓ Inserted/verified company: ${company.name} (${company.nseSymbol})`);
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
