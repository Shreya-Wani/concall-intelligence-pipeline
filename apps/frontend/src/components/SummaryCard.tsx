import React from 'react';
import { Link } from 'react-router-dom';
import { SummaryListItem } from '../types/api';
import { ArrowRight, Calendar, Tag } from 'lucide-react';

interface SummaryCardProps {
  summary: SummaryListItem;
}

export const SummaryCard: React.FC<SummaryCardProps> = ({ summary }) => {
  const { company, quarter, callDate, source, summaryJson, id } = summary;
  const tldrPoints = summaryJson?.tldr || [];

  return (
    <div className="bg-white border border-blue-200/80 rounded-xl p-5 shadow-sm hover:shadow-md hover:border-[#0078d4] transition-all flex flex-col justify-between group">
      <div>
        {/* Header badges */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-extrabold bg-[#0078d4] text-white shadow-xs">
            {quarter}
          </span>
          <span className="inline-flex items-center text-xs font-semibold text-blue-800 bg-blue-50 px-2.5 py-0.5 rounded border border-blue-200/80">
            <Tag className="w-3 h-3 mr-1 text-[#0078d4]" />
            {source}
          </span>
        </div>

        {/* Company Name */}
        <h3 className="text-base font-extrabold text-blue-950 mb-1 leading-snug group-hover:text-[#0078d4] transition-colors">
          {company.name}
        </h3>
        {company.nseSymbol && (
          <p className="text-xs text-slate-500 mb-3 font-mono">
            NSE: <span className="font-bold text-[#0078d4]">{company.nseSymbol}</span> {company.bseCode && `| BSE: ${company.bseCode}`}
          </p>
        )}

        {/* Call date if available */}
        {callDate && (
          <p className="text-xs text-slate-500 flex items-center mb-3 font-medium">
            <Calendar className="w-3.5 h-3.5 mr-1 text-[#0078d4]" />
            {callDate}
          </p>
        )}

        {/* TL;DR bullet points */}
        <div className="space-y-1.5 mb-4 bg-blue-50/50 p-3.5 rounded-lg border border-blue-100/80">
          <p className="text-[11px] font-bold text-blue-900 uppercase tracking-wider">Key Takeaways:</p>
          <ul className="text-xs text-slate-700 space-y-1">
            {tldrPoints.slice(0, 4).map((pt, idx) => (
              <li key={idx} className="flex items-start">
                <span className="text-[#0078d4] font-bold mr-1.5">•</span>
                <span className="line-clamp-2 leading-relaxed">{pt}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Action link with circular blue button matching uploaded image */}
      <div className="pt-3 border-t border-blue-100 flex items-center justify-between">
        <span className="text-xs font-bold text-slate-700 group-hover:text-[#0078d4] transition-colors">
          View Full AI Summary
        </span>
        <Link
          to={`/summary/${id}`}
          className="w-8 h-8 rounded-full bg-[#0078d4] hover:bg-[#0063b1] text-white flex items-center justify-center shadow-sm shadow-[#0078d4]/30 transition-transform group-hover:scale-105"
          aria-label={`View summary for ${company.name}`}
        >
          <ArrowRight className="w-4 h-4 stroke-[2.5]" />
        </Link>
      </div>
    </div>
  );
};


