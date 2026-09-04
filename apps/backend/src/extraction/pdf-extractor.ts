import fs from 'fs';
import { ExtractionPage, RawExtractionResult } from './types';

export async function extractPdfText(pdfPath: string): Promise<RawExtractionResult> {
  if (!fs.existsSync(pdfPath)) {
    throw new Error(`PDF file not found at path: ${pdfPath}`);
  }

  const dataBuffer = fs.readFileSync(pdfPath);
  const pages: ExtractionPage[] = [];

  try {
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs' as any).catch(
      () => import('pdfjs-dist' as any)
    );

    const pdfDoc = await pdfjsLib.getDocument({ data: new Uint8Array(dataBuffer) }).promise;
    const numPages = pdfDoc.numPages;

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdfDoc.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = reconstructLines(textContent.items as any[]);

      if (pageText.length > 0) {
        pages.push({
          pageNumber: pageNum,
          text: pageText,
          charCount: pageText.length,
        });
      }
    }

    if (pages.length > 0) {
      const fullText = pages.map((p) => p.text).join('\n\n');
      return {
        pageCount: pages.length,
        rawText: fullText,
        pages,
        metadata: { method: 'pdfjs_ycoord' },
      };
    }
  } catch (err: any) {
    console.warn(`[PDF EXTRACT] pdfjs-dist extraction failed: ${err.message}. Falling back to buffer extraction.`);
  }

  return bufferFallbackExtraction(dataBuffer);
}

function reconstructLines(items: Array<{ str: string; transform: number[] }>): string {
  if (items.length === 0) return '';

  type Item = { str: string; x: number; y: number; height: number };
  const parsed: Item[] = items
    .filter((item) => item.str && item.str.trim().length > 0)
    .map((item) => ({
      str: item.str,
      x: item.transform[4],
      y: item.transform[5],
      height: Math.abs(item.transform[3]) || 12,
    }));

  if (parsed.length === 0) return '';

  const TOLERANCE_FACTOR = 0.4;
  const lines: Item[][] = [];
  let currentLine: Item[] = [parsed[0]];

  for (let i = 1; i < parsed.length; i++) {
    const item = parsed[i];
    const lineY = currentLine[0].y;
    const lineHeight = currentLine[0].height;
    const tolerance = lineHeight * TOLERANCE_FACTOR;

    if (Math.abs(item.y - lineY) <= tolerance) {
      currentLine.push(item);
    } else {
      lines.push(currentLine);
      currentLine = [item];
    }
  }
  lines.push(currentLine);

  lines.sort((a, b) => b[0].y - a[0].y);

  return lines
    .map((line) =>
      line
        .sort((a, b) => a.x - b.x)
        .map((item) => item.str)
        .join(' ')
        .trim()
    )
    .filter((line) => line.length > 0)
    .join('\n');
}

function bufferFallbackExtraction(dataBuffer: Buffer): RawExtractionResult {
  const rawText = dataBuffer.toString('latin1').replace(/[^\x20-\x7E\n]/g, ' ').trim();

  if (rawText.length < 100) {
    return {
      pageCount: 0,
      rawText: '[EXTRACTION FAILED: No readable text found in PDF]',
      pages: [],
      metadata: { method: 'buffer_fallback', error: 'insufficient_text' },
    };
  }

  const pageSplit = rawText.split(/\n{3,}/).filter((p) => p.trim().length > 0);
  const fallbackPages: ExtractionPage[] = pageSplit.map((p, idx) => ({
    pageNumber: idx + 1,
    text: p.trim(),
    charCount: p.trim().length,
  }));

  return {
    pageCount: fallbackPages.length,
    rawText,
    pages: fallbackPages,
    metadata: { method: 'buffer_fallback' },
  };
}
