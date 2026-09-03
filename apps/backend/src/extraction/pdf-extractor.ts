import fs from 'fs';
import { ExtractionPage, RawExtractionResult } from './types';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfParse = require('pdf-parse');

export async function extractPdfText(pdfPath: string): Promise<RawExtractionResult> {
  if (!fs.existsSync(pdfPath)) {
    throw new Error(`PDF file not found at path: ${pdfPath}`);
  }

  const dataBuffer = fs.readFileSync(pdfPath);
  const pages: ExtractionPage[] = [];

  // Custom page render callback to capture per-page text
  const customPagerener = (pageData: any) => {
    return pageData.getTextContent().then((textContent: any) => {
      let lastY: number | null = null;
      let text = '';
      for (const item of textContent.items) {
        if (lastY === null || Math.abs(item.transform[5] - lastY) < 5) {
          text += item.str;
        } else {
          text += '\n' + item.str;
        }
        lastY = item.transform[5];
      }

      pages.push({
        pageNumber: pages.length + 1,
        text: text.trim(),
        charCount: text.trim().length,
      });

      return text;
    });
  };

  const parsed = await pdfParse(dataBuffer, {
    pagerender: customPagerener,
  });

  return {
    pageCount: parsed.numpages || pages.length || 1,
    rawText: parsed.text || '',
    pages: pages.length > 0 ? pages : [{ pageNumber: 1, text: parsed.text || '', charCount: (parsed.text || '').length }],
    metadata: parsed.metadata || parsed.info || {},
  };
}
