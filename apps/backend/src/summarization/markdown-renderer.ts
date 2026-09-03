import { SummaryContent } from '@concall/shared';

export function renderSummaryMarkdown(summary: SummaryContent): string {
  const lines: string[] = [];

  // Header
  lines.push(`# Executive Earnings Summary: ${summary.company}`);
  lines.push(`**Quarter:** ${summary.quarter} | **Source:** ${summary.source}`);
  if (summary.call_date) {
    lines.push(`**Call Date:** ${summary.call_date}`);
  }
  if (summary.nse_symbol || summary.scrip_code) {
    const ids = [];
    if (summary.nse_symbol) ids.push(`NSE: ${summary.nse_symbol}`);
    if (summary.scrip_code) ids.push(`BSE: ${summary.scrip_code}`);
    lines.push(`**Ticker / Scrip:** ${ids.join(' | ')}`);
  }
  lines.push('');

  // 1. Key Takeaways (TL;DR)
  lines.push('## Key Takeaways (TL;DR)');
  if (summary.tldr.length > 0) {
    summary.tldr.forEach((item) => lines.push(`- ${item}`));
  } else {
    lines.push('_Not disclosed in transcript._');
  }
  lines.push('');

  // 2. Key Metrics Table
  lines.push('## Key Metrics & Financial Figures');
  if (summary.key_metrics.length > 0) {
    lines.push('| Metric | Value | Context / Details |');
    lines.push('| :--- | :--- | :--- |');
    summary.key_metrics.forEach((m) => {
      lines.push(`| ${m.metric} | **${m.value}** | ${m.context} |`);
    });
  } else {
    lines.push('_Not disclosed in transcript._');
  }
  lines.push('');

  // 3. Management Commentary
  lines.push('## Management Commentary');
  if (summary.management_commentary.length > 0) {
    summary.management_commentary.forEach((item) => lines.push(`- ${item}`));
  } else {
    lines.push('_Not disclosed in transcript._');
  }
  lines.push('');

  // 4. Guidance & Outlook
  lines.push('## Guidance & Future Outlook');
  if (summary.guidance.length > 0) {
    summary.guidance.forEach((item) => lines.push(`- ${item}`));
  } else {
    lines.push('_Not disclosed in transcript._');
  }
  lines.push('');

  // 5. Segment Performance
  lines.push('## Segment Performance');
  if (summary.segment_performance.length > 0) {
    summary.segment_performance.forEach((seg) => {
      lines.push(`- **${seg.segment}:** ${seg.notes}`);
    });
  } else {
    lines.push('_Not disclosed in transcript._');
  }
  lines.push('');

  // 6. Notable Q&A
  lines.push('## Notable Q&A');
  if (summary.notable_qa.length > 0) {
    summary.notable_qa.forEach((qa, idx) => {
      lines.push(`### Q${idx + 1}: ${qa.question} _(Asked by: ${qa.asked_by})_`);
      lines.push(`**Answer:** ${qa.answer}`);
      lines.push('');
    });
  } else {
    lines.push('_Not disclosed in transcript._');
    lines.push('');
  }

  // 7. Key Risks
  lines.push('## Key Risks & Concerns');
  if (summary.risks.length > 0) {
    summary.risks.forEach((risk) => lines.push(`- ${risk}`));
  } else {
    lines.push('_Not disclosed in transcript._');
  }

  return lines.join('\n').trim();
}
