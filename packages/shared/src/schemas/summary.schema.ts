import { z } from 'zod';

export const SegmentPerformanceSchema = z.object({
  segment: z.string(),
  notes: z.string(),
});
export type SegmentPerformance = z.infer<typeof SegmentPerformanceSchema>;

export const KeyMetricSchema = z.object({
  metric: z.string(),
  value: z.string(),
  context: z.string(),
});
export type KeyMetric = z.infer<typeof KeyMetricSchema>;

export const NotableQASchema = z.object({
  question: z.string(),
  answer: z.string(),
  asked_by: z.string().nullable().optional(),
});
export type NotableQA = z.infer<typeof NotableQASchema>;

export const GroundingReportSchema = z.object({
  numericPrecision: z.number(),
  numbersChecked: z.number(),
  numbersVerified: z.number(),
  unverifiable: z.number(),
  dropped: z.array(z.object({
    section: z.string(),
    text: z.string(),
    missingFigures: z.array(z.string()),
  })).optional(),
});
export type GroundingReport = z.infer<typeof GroundingReportSchema>;

export const SummaryContentSchema = z.object({
  company: z.string(),
  scrip_code: z.string().nullable().optional(),
  nse_symbol: z.string().nullable().optional(),
  quarter: z.string(),
  quarter_inferred: z.boolean().optional(),
  call_date: z.string().nullable().optional(),
  source: z.string(),
  source_url: z.string().nullable().optional(),
  tldr: z.array(z.string()),
  management_commentary: z.array(z.string()),
  management_tone: z.string().nullable().optional(),
  guidance: z.array(z.string()),
  segment_performance: z.array(SegmentPerformanceSchema),
  key_metrics: z.array(KeyMetricSchema),
  notable_qa: z.array(NotableQASchema),
  risks: z.array(z.string()),
  grounding: GroundingReportSchema.optional(),
});

export type SummaryContent = z.infer<typeof SummaryContentSchema>;
