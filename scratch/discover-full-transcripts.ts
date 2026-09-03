import axios from 'axios';
import fs from 'fs';
import path from 'path';

// Known direct official IR and exchange archive URLs for Indian listed companies
const candidateList = [
  {
    company: 'Infosys Limited',
    nseSymbol: 'INFY',
    bseCode: '500209',
    quarter: 'Q1 FY25',
    callDate: 'July 18, 2024',
    source: 'Official Company IR',
    sourceUrl: 'https://www.infosys.com/investors/reports-filings/quarterly-results/2024-2025/q1.html',
    pdfUrl: 'https://www.infosys.com/investors/reports-filings/quarterly-results/2024-2025/q1/documents/q1-25-transcript.pdf',
  },
  {
    company: 'Infosys Limited',
    nseSymbol: 'INFY',
    bseCode: '500209',
    quarter: 'Q4 FY24',
    callDate: 'April 18, 2024',
    source: 'Official Company IR',
    sourceUrl: 'https://www.infosys.com/investors/reports-filings/quarterly-results/2023-2024/q4.html',
    pdfUrl: 'https://www.infosys.com/investors/reports-filings/quarterly-results/2023-2024/q4/documents/q4-24-transcript.pdf',
  },
  {
    company: 'Wipro Limited',
    nseSymbol: 'WIPRO',
    bseCode: '507685',
    quarter: 'Q1 FY25',
    callDate: 'July 19, 2024',
    source: 'Official Company IR',
    sourceUrl: 'https://www.wipro.com/investors/quarterly-results/',
    pdfUrl: 'https://www.wipro.com/content/dam/nexus/en/investor/quarterly-results/2024-2025/q1/wipro-q1fy25-transcript.pdf',
  },
  {
    company: 'HCL Technologies Limited',
    nseSymbol: 'HCLTECH',
    bseCode: '532281',
    quarter: 'Q1 FY25',
    callDate: 'July 12, 2024',
    source: 'Official Company IR',
    sourceUrl: 'https://www.hcltech.com/investors/results-reports',
    pdfUrl: 'https://www.hcltech.com/sites/default/files/hcltech-q1-fy25-earnings-call-transcript.pdf',
  },
  {
    company: 'Tata Consultancy Services Limited',
    nseSymbol: 'TCS',
    bseCode: '532540',
    quarter: 'Q1 FY25',
    callDate: 'July 11, 2024',
    source: 'BSE Corporate Disclosure',
    sourceUrl: 'https://www.bseindia.com/corporates/anndet_new.aspx?newsid=5888e223-45e0-4a84-904e-289cfeb3ce25',
    pdfUrl: 'https://www.bseindia.com/xml-data/corpfiling/AttachLive/5888e223-45e0-4a84-904e-289cfeb3ce25.pdf',
  },
  {
    company: 'Reliance Industries Limited',
    nseSymbol: 'RELIANCE',
    bseCode: '500325',
    quarter: 'Q1 FY25',
    callDate: 'July 19, 2024',
    source: 'Official Company IR',
    sourceUrl: 'https://www.ril.com/investors/financial-reporting',
    pdfUrl: 'https://www.ril.com/ar2023-24/pdf/Q1_FY25_Transcript.pdf',
  },
  {
    company: 'ICICI Bank Limited',
    nseSymbol: 'ICICIBANK',
    bseCode: '532174',
    quarter: 'Q1 FY25',
    callDate: 'July 27, 2024',
    source: 'Official Company IR',
    sourceUrl: 'https://www.icicibank.com/about-us/investor-relations',
    pdfUrl: 'https://www.icicibank.com/managed-assets/docs/investor/quarterly-financial-results/2025/q1-fy25-earnings-call-transcript.pdf',
  },
  {
    company: 'Bharti Airtel Limited',
    nseSymbol: 'BHARTIARTL',
    bseCode: '532454',
    quarter: 'Q1 FY25',
    callDate: 'August 6, 2024',
    source: 'Official Company IR',
    sourceUrl: 'https://www.airtel.in/about-bharti/equity/results',
    pdfUrl: 'https://assets.airtel.in/teams/company-portal/investors/doc/transcript-q1-fy25.pdf',
  },
  {
    company: 'Axis Bank Limited',
    nseSymbol: 'AXISBANK',
    bseCode: '532215',
    quarter: 'Q1 FY25',
    callDate: 'July 24, 2024',
    source: 'Official Company IR',
    sourceUrl: 'https://www.axisbank.com/shareholders-corner/financial-results',
    pdfUrl: 'https://www.axisbank.com/docs/default-source/quarterly-results/q1fy25-earnings-call-transcript.pdf',
  },
  {
    company: 'Titan Company Limited',
    nseSymbol: 'TITAN',
    bseCode: '500114',
    quarter: 'Q1 FY25',
    callDate: 'August 2, 2024',
    source: 'Official Company IR',
    sourceUrl: 'https://www.titancompany.in/investors/financial-information',
    pdfUrl: 'https://www.titancompany.in/sites/default/files/Titan-Q1FY25-Earnings-Call-Transcript.pdf',
  },
];

async function testCandidates() {
  console.log('🔍 Testing candidate URLs for Genuine FULL_TRANSCRIPT PDFs...\n');

  for (const c of candidateList) {
    console.log(`Checking [${c.nseSymbol}] ${c.company} (${c.quarter})...`);
    console.log(`  URL: ${c.pdfUrl}`);

    try {
      const res = await axios.get(c.pdfUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
          'Accept': 'application/pdf,application/xhtml+xml,text/html;q=0.9,*/*;q=0.8',
        },
        responseType: 'arraybuffer',
        timeout: 8000,
        maxRedirects: 5,
      });

      const buf = Buffer.from(res.data);
      const magic = buf.subarray(0, 4).toString();
      const bytes = buf.length;

      console.log(`  HTTP Status: ${res.status}`);
      console.log(`  Magic Bytes: "${magic}"`);
      console.log(`  Size: ${bytes.toLocaleString()} bytes`);

      if (magic === '%PDF' && bytes > 30000) {
        // Quick string check for operator and Q&A indicators
        const rawStr = buf.toString('utf-8');
        const hasOperator = /operator|moderator/i.test(rawStr);
        const hasQa = /question|analyst|q&a/i.test(rawStr);
        const hasManagement = /management|participants|speaker|director/i.test(rawStr);

        console.log(`  Content Indicators: Operator=${hasOperator}, Q&A=${hasQa}, Management=${hasManagement}`);
        console.log(`  STATUS: ✅ VALID ACCESSIBLE PDF (Size > 30KB)`);
      } else {
        console.log(`  STATUS: ⚠️ Not a standard large PDF (Magic: ${magic})`);
      }
    } catch (err: any) {
      console.log(`  HTTP Status / Error: ${err.response?.status || err.message}`);
      console.log(`  STATUS: ❌ FAILED TO ACCESS`);
    }
    console.log('');
  }
}

testCandidates();
