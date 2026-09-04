import { ExtractionPage } from './types';

export function removePageNumbers(line: string): string | null {
  const trimmed = line.trim();
  if (/^page\s+\d+(?:\s+of\s+\d+)?$/i.test(trimmed)) return null;
  if (/^\d+\s+of\s+\d+$/.test(trimmed)) return null;
  if (/^\d{1,3}$/.test(trimmed)) return null;
  return line;
}

export function isPageNumberLine(line: string, isEdge: boolean): boolean {
  if (!isEdge) return false;
  return removePageNumbers(line) === null;
}

function normalizeHeaderKey(line: string): string {
  return line.trim().toLowerCase().replace(/\d+/g, '#');
}

export function detectRepeatedHeadersFooters(pages: ExtractionPage[]): Set<string> {
  if (pages.length < 3) return new Set();

  const keyFrequency = new Map<string, number>();
  const keyToOriginal = new Map<string, string>();

  for (const page of pages) {
    const lines = page.text.split('\n').map((l) => l.trim()).filter((l) => l.length > 5);
    if (lines.length < 2) continue;

    const candidates = new Set([...lines.slice(0, 2), ...lines.slice(-2)]);

    for (const line of candidates) {
      if (/[\u20b9$]|\d+\s*(?:crore|cr|lakh|mn|bn|million|billion|%|bps)/i.test(line)) continue;
      const key = normalizeHeaderKey(line);
      keyFrequency.set(key, (keyFrequency.get(key) || 0) + 1);
      keyToOriginal.set(key, line);
    }
  }

  const repeated = new Set<string>();
  const threshold = Math.max(3, Math.ceil(pages.length * 0.4));

  keyFrequency.forEach((count, key) => {
    if (count >= threshold) {
      const original = keyToOriginal.get(key)!;
      repeated.add(original);
    }
  });

  return repeated;
}

export function normalizeSpeakerLabels(text: string): string {
  const SPEAKER_RE = /(?:^|\s+)((?:Management|Analyst|Moderator|Questioner|Operator|[A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+)?)(?:\s*[-–]\s*[A-Za-z ]+)?:)/g;

  return text.replace(SPEAKER_RE, (match, p1, offset) => {
    if (offset === 0) return p1;
    return '\n' + p1;
  });
}

export function cleanTranscriptText(
  pages: ExtractionPage[]
): { cleanedText: string; characterCount: number } {
  const repeatedArtifacts = detectRepeatedHeadersFooters(pages);
  const cleanedPages: string[] = [];

  for (const page of pages) {
    const lines = page.text.split('\n');
    const pageLineCount = lines.length;
    const processedLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      if (!trimmed) { processedLines.push(''); continue; }

      const normalizedLine = normalizeHeaderKey(trimmed);
      const isRepeated = [...repeatedArtifacts].some(
        (artifact) => normalizeHeaderKey(artifact) === normalizedLine
      );
      if (isRepeated) continue;

      const isEdge = i < 2 || i >= pageLineCount - 2;
      if (isPageNumberLine(line, isEdge)) continue;

      processedLines.push(line.replace(/[\f\0\v]/g, '').trimEnd());
    }

    const pageContent = processedLines.join('\n');
    if (pageContent.trim().length > 0) {
      cleanedPages.push(pageContent);
    }
  }

  let fullText = cleanedPages.join('\n\n');
  fullText = normalizeSpeakerLabels(fullText);
  fullText = fullText.replace(/\n{3,}/g, '\n\n').trim();

  return { cleanedText: fullText, characterCount: fullText.length };
}
