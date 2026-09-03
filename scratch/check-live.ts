import { BseClient } from '../apps/backend/src/watcher/bse.client';
import { parseBseAnnouncement } from '../apps/backend/src/watcher/bse.parser';
import { isTranscriptFiling, matchSeededCompany } from '../apps/backend/src/watcher/filters';
import { NseClient } from '../apps/backend/src/watcher/nse.client';
import { parseNseAnnouncement } from '../apps/backend/src/watcher/nse.parser';

async function checkLiveAnnouncements() {
  console.log('🔍 Checking Live NSE & BSE for concall transcripts...');

  const nseClient = new NseClient();
  const bseClient = new BseClient();

  const nseAnn = await nseClient.fetchAnnouncements().catch(() => []);
  console.log(`NSE returned ${nseAnn.length} announcements.`);

  for (const raw of nseAnn) {
    const filing = parseNseAnnouncement(raw);
    if (filing && isTranscriptFiling(filing.subject, filing.eventType)) {
      const match = matchSeededCompany({
        nseSymbol: filing.nseSymbol,
        bseCode: filing.bseCode,
        isin: filing.isin,
        companyName: filing.companyName,
      });
      if (match) {
        console.log('🎯 [NSE MATCH]', match.name, filing.subject, filing.pdfUrl);
      }
    }
  }

  const bseAnn = await bseClient.fetchAnnouncements().catch(() => []);
  console.log(`BSE returned ${bseAnn.length} announcements.`);

  for (const raw of bseAnn) {
    const filing = parseBseAnnouncement(raw);
    if (filing && isTranscriptFiling(filing.subject, filing.eventType)) {
      const match = matchSeededCompany({
        nseSymbol: filing.nseSymbol,
        bseCode: filing.bseCode,
        isin: filing.isin,
        companyName: filing.companyName,
      });
      if (match) {
        console.log('🎯 [BSE MATCH]', match.name, filing.subject, filing.pdfUrl);
      }
    }
  }
}

checkLiveAnnouncements().catch(console.error);
