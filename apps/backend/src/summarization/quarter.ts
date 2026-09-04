export interface QuarterResult {
  quarter: string;
  quarter_inferred: boolean;
}

const MONTH_TO_QUARTER: Record<string, 1 | 2 | 3 | 4> = {
  april: 1, may: 1, june: 1,
  july: 2, august: 2, september: 2,
  october: 3, november: 3, december: 3,
  january: 4, february: 4, march: 4,
};

const ORDINAL_TO_QUARTER: Record<string, 1 | 2 | 3 | 4> = {
  first: 1, second: 2, third: 3, fourth: 4,
};

function normalizeYear(raw: string): number {
  const n = parseInt(raw, 10);
  return n < 100 ? 2000 + n : n;
}

function toFYLabel(calendarYear: number, qNum: 1 | 2 | 3 | 4): string {
  const fyEndYear = qNum === 4 ? calendarYear : calendarYear + 1;
  return `Q${qNum} FY${String(fyEndYear).slice(-2)}`;
}

export function deriveQuarterFromText(text: string): QuarterResult | null {
  const directRegex = /(Q[1-4])\s*FY\s*(\d{2,4})/gi;
  let m = directRegex.exec(text);
  if (m) {
    return { quarter: `${m[1].toUpperCase()} FY${String(normalizeYear(m[2])).slice(-2)}`, quarter_inferred: false };
  }

  const ordinalRegex = /\b(first|second|third|fourth)\s+quarter\s+(?:of\s+)?FY\s*(\d{2,4})/gi;
  m = ordinalRegex.exec(text);
  if (m) {
    const qNum = ORDINAL_TO_QUARTER[m[1].toLowerCase()];
    return { quarter: `Q${qNum} FY${String(normalizeYear(m[2])).slice(-2)}`, quarter_inferred: false };
  }

  const endedRegex = /quarter(?:ly)?\s+(?:ended?|ending)\s+(?:\d{1,2}\s+)?(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/gi;
  m = endedRegex.exec(text);
  if (m) {
    const month = m[1].toLowerCase();
    const year = parseInt(m[2], 10);
    const qNum = MONTH_TO_QUARTER[month];
    if (qNum) {
      return { quarter: toFYLabel(year, qNum), quarter_inferred: false };
    }
  }

  return null;
}

export function deriveQuarterFromDate(date: Date): QuarterResult {
  const month = date.getMonth() + 1;
  const year = date.getFullYear();

  let qNum: 1 | 2 | 3 | 4;
  let fyEndYear: number;

  if (month >= 4 && month <= 6) {
    qNum = 1; fyEndYear = year + 1;
  } else if (month >= 7 && month <= 9) {
    qNum = 2; fyEndYear = year + 1;
  } else if (month >= 10 && month <= 12) {
    qNum = 3; fyEndYear = year + 1;
  } else {
    qNum = 4; fyEndYear = year;
  }

  return {
    quarter: `Q${qNum} FY${String(fyEndYear).slice(-2)}`,
    quarter_inferred: true,
  };
}

export function resolveQuarter(
  transcriptText: string | null | undefined,
  filingDate: Date | null | undefined,
  subjectLine: string | null | undefined
): QuarterResult {
  if (transcriptText) {
    const fromText = deriveQuarterFromText(transcriptText);
    if (fromText) return fromText;
  }

  if (subjectLine) {
    const fromSubject = deriveQuarterFromText(subjectLine);
    if (fromSubject) return fromSubject;
  }

  if (filingDate) {
    return deriveQuarterFromDate(filingDate);
  }

  return deriveQuarterFromDate(new Date());
}
