export interface GroundingReport {
  numericPrecision: number;
  numbersChecked: number;
  numbersVerified: number;
  unverifiable: number;
  dropped: DropRecord[];
}

export interface DropRecord {
  section: string;
  text: string;
  missingFigures: string[];
}

const NUMBER_RE = /(?:₹|Rs\.?|\$|USD|EUR|GBP)?\s*\d[\d,.']*(?:\s*(?:crore|cr|lakh|lakh|million|billion|mn|bn))?(?:\s*%|\s*bps|\s*x)?/gi;

function extractNumbers(text: string): string[] {
  const matches = text.match(NUMBER_RE) || [];
  return matches
    .map((m) => m.trim())
    .filter((m) => m.length > 0 && /\d/.test(m));
}

function normalize(token: string): string {
  return token
    .toLowerCase()
    .replace(/[₹$,\s]/g, '')
    .replace(/rs\.?/g, '')
    .replace(/crore|cr\b/g, 'cr')
    .replace(/lakh/g, 'lakh')
    .replace(/million|mn/g, 'mn')
    .replace(/billion|bn/g, 'bn')
    .replace(/\.0+(%|bps|x|cr|mn|bn|lakh)?$/, '$1');
}

function isFoundInTranscript(figure: string, transcriptNorms: Set<string>): boolean {
  const norm = normalize(figure);
  if (transcriptNorms.has(norm)) return true;
  for (const t of transcriptNorms) {
    if (t.startsWith(norm) || norm.startsWith(t)) return true;
  }
  return false;
}

function stringsFromValue(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) {
    return value.flatMap((v) => stringsFromValue(v));
  }
  if (value && typeof value === 'object') {
    return Object.values(value).flatMap((v) => stringsFromValue(v));
  }
  return [];
}

export function groundSummary(
  summary: Record<string, unknown>,
  transcriptText: string
): GroundingReport {
  const transcriptNumbers = extractNumbers(transcriptText);
  const transcriptNorms = new Set(transcriptNumbers.map(normalize));

  let checked = 0;
  let verified = 0;
  const dropped: DropRecord[] = [];

  const SECTIONS = [
    'tldr', 'management_commentary', 'guidance',
    'segment_performance', 'key_metrics', 'notable_qa', 'risks',
  ];

  for (const section of SECTIONS) {
    const value = summary[section];
    if (!value) continue;

    const texts = stringsFromValue(value);
    for (const text of texts) {
      const figures = extractNumbers(text);
      if (figures.length === 0) continue;

      const missingFigures: string[] = [];
      for (const fig of figures) {
        checked++;
        if (isFoundInTranscript(fig, transcriptNorms)) {
          verified++;
        } else {
          missingFigures.push(fig);
        }
      }

      if (missingFigures.length > 0) {
        dropped.push({ section, text, missingFigures });
      }
    }
  }

  const precision = checked > 0 ? verified / checked : 1;

  return {
    numericPrecision: Math.round(precision * 100) / 100,
    numbersChecked: checked,
    numbersVerified: verified,
    unverifiable: dropped.reduce((acc, d) => acc + d.missingFigures.length, 0),
    dropped,
  };
}
