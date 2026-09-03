"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SummaryContentSchema = exports.NotableQASchema = exports.KeyMetricSchema = exports.SegmentPerformanceSchema = void 0;
const zod_1 = require("zod");
exports.SegmentPerformanceSchema = zod_1.z.object({
    segment: zod_1.z.string(),
    notes: zod_1.z.string(),
});
exports.KeyMetricSchema = zod_1.z.object({
    metric: zod_1.z.string(),
    value: zod_1.z.string(),
    context: zod_1.z.string(),
});
exports.NotableQASchema = zod_1.z.object({
    question: zod_1.z.string(),
    answer: zod_1.z.string(),
    asked_by: zod_1.z.string(),
});
exports.SummaryContentSchema = zod_1.z.object({
    company: zod_1.z.string(),
    scrip_code: zod_1.z.string().nullable().optional(),
    nse_symbol: zod_1.z.string().nullable().optional(),
    quarter: zod_1.z.string(),
    call_date: zod_1.z.string().nullable().optional(),
    source: zod_1.z.string(),
    source_url: zod_1.z.string().nullable().optional(),
    tldr: zod_1.z.array(zod_1.z.string()),
    management_commentary: zod_1.z.array(zod_1.z.string()),
    guidance: zod_1.z.array(zod_1.z.string()),
    segment_performance: zod_1.z.array(exports.SegmentPerformanceSchema),
    key_metrics: zod_1.z.array(exports.KeyMetricSchema),
    notable_qa: zod_1.z.array(exports.NotableQASchema),
    risks: zod_1.z.array(zod_1.z.string()),
});
