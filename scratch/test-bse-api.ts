import fs from 'fs';
import path from 'path';

async function searchBseTranscripts() {
  console.log('📡 Querying BSE India Corporate Announcements API for genuine transcript PDFs...\n');

  try {
    const url = 'https://api.bseindia.com/BseIndiaAPI/api/AnnSubmission/w?pageNo=1&strCat=Company+Update&strPrev=0&strScrip=&strSearch=Transcript';

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Referer': 'https://www.bseindia.com/',
      },
    });

    const data = await response.json();
    const items = data?.Table || data || [];
    console.log(`Found ${items.length} announcements matching "Transcript":\n`);

    const candidates: any[] = [];

    for (const item of items.slice(0, 20)) {
      const subject = item.NEWSSUB || item.SUBJECT || item.NEWS_SUBJECT || '';
      const scripCode = item.SCRIP_CD || item.SLONGNAME || '';
      const companyName = item.COMPANY_NAME || item.SLONGNAME || '';
      const attachFile = item.ATTACHMENTNAME || item.ATTACHMENT_NAME || '';
      const dt = item.NEWS_DT || item.DISDT || '';

      if (attachFile && /transcript/i.test(subject)) {
        const attachmentUrl = `https://www.bseindia.com/xml-data/corpfiling/AttachLive/${attachFile}`;
        console.log(`Company: ${companyName} (${scripCode})`);
        console.log(`Subject: ${subject}`);
        console.log(`Date: ${dt}`);
        console.log(`Attachment: ${attachmentUrl}`);

        candidates.push({
          companyName,
          scripCode,
          subject,
          date: dt,
          attachmentUrl,
          fileName: attachFile,
        });
        console.log('--------------------------------------------------');
      }
    }

    // Verify candidate attachments
    for (const c of candidates) {
      try {
        const pdfRes = await fetch(c.attachmentUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
            'Referer': 'https://www.bseindia.com/',
          },
        });

        if (!pdfRes.ok) {
          console.log(`\nFailed to fetch ${c.companyName} (${pdfRes.status})`);
          continue;
        }

        const arrayBuf = await pdfRes.arrayBuffer();
        const buf = Buffer.from(arrayBuf);
        const magic = buf.subarray(0, 4).toString();
        const size = buf.length;

        console.log(`\nTesting [${c.companyName}] -> ${c.attachmentUrl}`);
        console.log(`  Size: ${size.toLocaleString()} bytes, Magic: "${magic}"`);

        if (magic === '%PDF') {
          const textStr = buf.toString('utf-8');
          const pageMatches = textStr.match(/\/Type\s*\/Page\b/g);
          const pageCount = pageMatches ? pageMatches.length : 1;

          console.log(`  PDF Page Count Estimate: ${pageCount}`);
          const hasQa = /question|analyst|q&a|management/i.test(textStr);
          console.log(`  Contains Q&A/Management keywords: ${hasQa}`);
          console.log(`  Classification: ${pageCount >= 5 && size > 50000 ? '✅ FULL_TRANSCRIPT' : '⚠️ SHORT_EXCERPT_OR_INTIMATION'}`);
        }
      } catch (err: any) {
        console.log(`  Failed to verify ${c.attachmentUrl}: ${err.message}`);
      }
    }
  } catch (err: any) {
    console.error('BSE API Error:', err.message);
  }
}

searchBseTranscripts();
