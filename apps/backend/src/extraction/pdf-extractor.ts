import fs from 'fs';
import { ExtractionPage, RawExtractionResult } from './types';

export async function extractPdfText(pdfPath: string): Promise<RawExtractionResult> {
  if (!fs.existsSync(pdfPath)) {
    throw new Error(`PDF file not found at path: ${pdfPath}`);
  }

  const dataBuffer = fs.readFileSync(pdfPath);
  const pages: ExtractionPage[] = [];

  // Try standard pdf-parse or pdfjs-dist extraction first
  try {
    const pdfParse = require('pdf-parse');
    const parseFunc = typeof pdfParse === 'function' ? pdfParse : pdfParse.default || pdfParse;

    if (typeof parseFunc === 'function') {
      const customPagerender = (pageData: any) => {
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

      const parsed = await parseFunc(dataBuffer, { pagerender: customPagerender });

      if (parsed && parsed.text && parsed.text.trim().length > 50) {
        return {
          pageCount: parsed.numpages || pages.length || 1,
          rawText: parsed.text || '',
          pages: pages.length > 0 ? pages : [{ pageNumber: 1, text: parsed.text || '', charCount: (parsed.text || '').length }],
          metadata: parsed.metadata || parsed.info || {},
        };
      }
    }
  } catch (err: any) {
    console.warn(`[PDF EXTRACT] Primary pdf-parse warning: ${err.message}. Running stream text extractor...`);
  }

  // Resilient text stream extraction from PDF buffer
  const rawString = dataBuffer.toString('utf-8');
  // Match text literal streams between '(' and ')' or text blocks
  const textMatches: string[] = [];
  const lineRegex = /\(([^)]+)\)\s*Tj/g;
  let match: RegExpExecArray | null;

  while ((match = lineRegex.exec(rawString)) !== null) {
    if (match[1]) {
      const cleanLine = match[1].replace(/\\([()])/g, '$1').replace(/\\\\/g, '\\');
      textMatches.push(cleanLine);
    }
  }

  const extractedText = textMatches.length > 0 ? textMatches.join('\n') : rawString.replace(/[^\x20-\x7E\n]/g, '');
  const pageSplit = extractedText.split('\n\n\n').filter((p) => p.trim().length > 0);

  const fallbackPages: ExtractionPage[] =
    pageSplit.length > 0
      ? pageSplit.map((p, idx) => ({ pageNumber: idx + 1, text: p.trim(), charCount: p.trim().length }))
      : [{ pageNumber: 1, text: extractedText.trim(), charCount: extractedText.trim().length }];

  return {
    pageCount: fallbackPages.length,
    rawText: extractedText,
    pages: fallbackPages,
    metadata: { method: 'stream_extractor' },
  };
}
