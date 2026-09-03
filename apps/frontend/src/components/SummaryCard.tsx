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
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-colors flex flex-col justify-between">
      <div>
        {/* Header badges */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-950 text-blue-300 border border-blue-800">
            {quarter}
          </span>
          <span className="inline-flex items-center text-xs font-medium text-slate-400">
            <Tag className="w-3 h-3 mr-1" />
            {source}
          </span>
        </div>

        {/* Company Name */}
        <h3 className="text-lg font-semibold text-white mb-1 leading-snug">{company.name}</h3>
        {company.nseSymbol && (
          <p className="text-xs text-slate-400 mb-3 font-mono">
            NSE: {company.nseSymbol} {company.bseCode && `| BSE: ${company.bseCode}`}
          </p>
        )}

        {/* Call date if available */}
        {callDate && (
          <p className="text-xs text-slate-400 flex items-center mb-3">
            <Calendar className="w-3 h-3 mr-1" />
            {callDate}
          </p>
        )}

        {/* TL;DR bullet points */}
        <div className="space-y-1.5 mb-4">
          <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Key Takeaways:</p>
          <ul className="text-xs text-slate-300 space-y-1">
            {tldrPoints.slice(0, 4).map((pt, idx) => (
              <li key={idx} className="flex items-start">
                <span className="text-blue-400 mr-1.5">•</span>
                <span className="line-clamp-2">{pt}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Action link */}
      <div className="pt-3 border-t border-slate-800/80">
        <Link
          to={`/summary/${id}`}
          className="inline-flex items-center text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors"
        >
          View Full AI Summary
          <ArrowRight className="w-3.5 h-3.5 ml-1" />
        </Link>
      </div>
    </div>
  );
};
