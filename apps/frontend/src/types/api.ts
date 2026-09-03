import { SummaryContent } from '@concall/shared';

export interface Company {
  id: string;
  name: string;
  nseSymbol?: string | null;
  bseCode?: string | null;
  isin?: string | null;
  sector?: string | null;
  createdAt?: string;
}

export interface SummaryListItem {
  id: string;
  company: {
    id: string;
    name: string;
    nseSymbol?: string | null;
    bseCode?: string | null;
  };
  quarter: string;
  callDate?: string | null;
  source: string;
  model: string;
  createdAt: string;
  summaryJson: SummaryContent;
  summaryMarkdown: string;
}

export interface SummaryPagination {
  limit: number;
  offset: number;
  total: number;
}

export interface SummariesResponse {
  items: SummaryListItem[];
  pagination: SummaryPagination;
}

export interface SummaryDetail {
  id: string;
  company: Company;
  quarter: string;
  callDate?: string | null;
  source: string;
  sourceAnnouncementId?: string;
  sourceUrl?: string | null;
  model: string;
  promptVersion?: string;
  createdAt: string;
  summaryJson: SummaryContent;
  summaryMarkdown: string;
  transcript?: {
    id: string;
    characterCount: number;
    pageCount: number;
    extractionMethod: string;
  } | null;
}

export interface FilingDetail {
  id: string;
  company: Company;
  source: string;
  sourceAnnouncementId: string;
  filingDate: string;
  eventType: string;
  subject: string;
  sourceUrl?: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  transcript?: {
    id: string;
    characterCount: number;
    pageCount: number;
    extractionMethod: string;
  } | null;
  summary?: {
    id: string;
    model: string;
    promptVersion?: string;
    createdAt: string;
  } | null;
}
