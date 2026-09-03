export interface ExtractionPage {
  pageNumber: number;
  text: string;
  charCount: number;
}

export interface RawExtractionResult {
  pageCount: number;
  rawText: string;
  pages: ExtractionPage[];
  metadata?: Record<string, any>;
}

export interface QualityResult {
  passed: boolean;
  score: number; // 0.0 to 1.0
  isScannedPdf: boolean;
  warnings: string[];
  metrics: {
    totalCharCount: number;
    pageCount: number;
    avgCharsPerPage: number;
    printableRatio: number;
    nearlyEmptyPageCount: number;
  };
}

export interface CleanedTranscript {
  text: string;
  characterCount: number;
  pageCount: number;
  quality: QualityResult;
  extractionMethod: 'pdf_text' | 'OCR_REQUIRED';
}

export interface ExtractionMetadata {
  extractionMethod: string;
  pageCount: number;
  characterCount: number;
  quality: {
    passed: boolean;
    score: number;
    isScannedPdf: boolean;
    warnings: string[];
    metrics: {
      totalCharCount: number;
      pageCount: number;
      avgCharsPerPage: number;
      printableRatio: number;
      nearlyEmptyPageCount: number;
    };
  };
  extractedAt: string;
}
