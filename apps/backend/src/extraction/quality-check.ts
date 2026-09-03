import { ExtractionPage, QualityResult } from './types';

export function evaluateTranscriptQuality(cleanedText: string, pageCount: number, pages: ExtractionPage[]): QualityResult {
  const totalCharCount = cleanedText.length;
  const avgCharsPerPage = pageCount > 0 ? totalCharCount / pageCount : 0;

  // Calculate printable character ratio
  let printableCount = 0;
  for (let i = 0; i < cleanedText.length; i++) {
    const code = cleanedText.charCodeAt(i);
    // Standard printable ASCII (32-126), tab (9), newline (10), carriage return (13), and extended Unicode
    if ((code >= 32 && code <= 126) || code === 9 || code === 10 || code === 13 || code > 127) {
      printableCount++;
    }
  }

  const printableRatio = totalCharCount > 0 ? printableCount / totalCharCount : 0;

  // Count nearly empty pages (< 100 characters)
  let nearlyEmptyPageCount = 0;
  for (const page of pages) {
    if (page.charCount < 100) {
      nearlyEmptyPageCount++;
    }
  }

  const warnings: string[] = [];
  let isScannedPdf = false;

  // Multi-signal heuristic for scanned/image-only PDF detection
  const emptyRatio = pageCount > 0 ? nearlyEmptyPageCount / pageCount : 1;

  if (totalCharCount < 300 || avgCharsPerPage < 100 || emptyRatio > 0.8) {
    isScannedPdf = true;
    warnings.push('Scanned image PDF detected. Low text density. OCR required.');
  }

  if (printableRatio < 0.85) {
    warnings.push(`Low printable character ratio (${(printableRatio * 100).toFixed(1)}%). Possible extraction noise.`);
  }

  // Calculate overall score (0.0 to 1.0)
  let score = 1.0;
  if (isScannedPdf) score -= 0.6;
  if (printableRatio < 0.85) score -= 0.2;
  if (emptyRatio > 0.3) score -= 0.2;

  score = Math.max(0, Math.min(1, Math.round(score * 100) / 100));
  const passed = !isScannedPdf && score >= 0.6;

  return {
    passed,
    score,
    isScannedPdf,
    warnings,
    metrics: {
      totalCharCount,
      pageCount,
      avgCharsPerPage: Math.round(avgCharsPerPage * 10) / 10,
      printableRatio: Math.round(printableRatio * 1000) / 1000,
      nearlyEmptyPageCount,
    },
  };
}
