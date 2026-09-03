import { ExtractionPage } from './types';

export function removePageNumbers(line: string): string | null {
  const trimmed = line.trim();

  // Match pattern: "Page 12", "Page 12 of 45", "12 of 45", or standalone number 1-300
  if (/^page\s+\d+(\s+of\s+\d+)?$/i.test(trimmed)) return null;
  if (/^\d+\s+of\s+\d+$/i.test(trimmed)) return null;
  if (/^\d{1,3}$/.test(trimmed)) return null;

  return line;
}

export function detectRepeatedHeadersFooters(pages: ExtractionPage[]): Set<string> {
  if (pages.length < 2) return new Set();

  const lineFrequency = new Map<string, number>();

  for (const page of pages) {
    const lines = page.text.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
    if (lines.length === 0) continue;

    // Check top 2 lines (headers) and bottom 2 lines (footers)
    const candidates = new Set<string>();
    const topLines = lines.slice(0, 2);
    const bottomLines = lines.slice(-2);

    [...topLines, ...bottomLines].forEach((line) => {
      // Ignore very short lines or numerical page numbers
      if (line.length > 5 && !/^\d+$/.test(line)) {
        candidates.add(line);
      }
    });

    candidates.forEach((cand) => {
      lineFrequency.set(cand, (lineFrequency.get(cand) || 0) + 1);
    });
  }

  const repeated = new Set<string>();
  const threshold = Math.max(2, Math.ceil(pages.length * 0.5)); // Frequency threshold >= 50%

  lineFrequency.forEach((count, line) => {
    // Ensure repeated line is a header/footer artifact and not common financial terms like "Revenue" or "TCS"
    const lower = line.toLowerCase();
    const isFinancialTerm = /^(revenue|ebitda|profit|pat|tcs|tata motors|sun pharma|q1|q2|q3|q4|fy25|fy26)$/i.test(lower);
    if (count >= threshold && !isFinancialTerm) {
      repeated.add(line);
    }
  });

  return repeated;
}

export function cleanTranscriptText(pages: ExtractionPage[]): { cleanedText: string; characterCount: number } {
  const repeatedArtifacts = detectRepeatedHeadersFooters(pages);
  const cleanedPages: string[] = [];

  for (const page of pages) {
    const lines = page.text.split('\n');
    const processedLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Skip repeated header/footer artifacts
      if (repeatedArtifacts.has(trimmed)) {
        continue;
      }

      // Filter page number artifacts
      const filtered = removePageNumbers(line);
      if (filtered === null) {
        continue;
      }

      // Remove control characters (form feeds, null bytes)
      const cleanLine = filtered.replace(/[\f\0\v]/g, '').trimEnd();
      processedLines.push(cleanLine);
    }

    const pageContent = processedLines.join('\n');
    if (pageContent.trim().length > 0) {
      cleanedPages.push(pageContent);
    }
  }

  // Join cleaned pages with double newline separator
  let fullText = cleanedPages.join('\n\n');

  // Normalize excessive blank lines (3 or more consecutive newlines -> 2)
  fullText = fullText.replace(/\n{3,}/g, '\n\n');

  return {
    cleanedText: fullText.trim(),
    characterCount: fullText.trim().length,
  };
}
