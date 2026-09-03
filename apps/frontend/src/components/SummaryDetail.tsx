import React from 'react';
import { SummaryDetail as SummaryDetailType } from '../types/api';
import { AlertTriangle, Building2, Calendar, FileText, HelpCircle, Layers, LineChart, MessageSquare, Target } from 'lucide-react';

interface SummaryDetailProps {
  summary: SummaryDetailType;
}

export const SummaryDetail: React.FC<SummaryDetailProps> = ({ summary }) => {
  const { company, quarter, callDate, source, model, summaryJson, transcript } = summary;

  const tldr = summaryJson?.tldr || [];
  const management = summaryJson?.management_commentary || [];
  const guidance = summaryJson?.guidance || [];
  const segments = summaryJson?.segment_performance || [];
  const metrics = summaryJson?.key_metrics || [];
  const qa = summaryJson?.notable_qa || [];
  const risks = summaryJson?.risks || [];

  const renderListSection = (title: string, icon: React.ReactNode, items: string[]) => (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-6">
      <h3 className="text-base font-semibold text-white flex items-center mb-3">
        {icon}
        <span className="ml-2">{title}</span>
      </h3>
      {items.length === 0 || (items.length === 1 && items[0].includes('Not disclosed')) ? (
        <p className="text-sm text-slate-400 italic">Not disclosed in transcript.</p>
      ) : (
        <ul className="space-y-2 text-sm text-slate-300">
          {items.map((item, idx) => (
            <li key={idx} className="flex items-start">
              <span className="text-blue-400 mr-2">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-blue-950 text-blue-300 border border-blue-800 text-xs font-bold rounded-md">
              {quarter}
            </span>
            <span className="px-2.5 py-1 bg-slate-800 text-slate-300 text-xs font-medium rounded-md">
              Source: {source}
            </span>
          </div>
          <span className="text-xs text-slate-400 font-mono">Model: {model}</span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">{company.name}</h1>

        <div className="flex flex-wrap gap-4 text-xs text-slate-400">
          {company.nseSymbol && <span>NSE: <strong className="text-slate-300">{company.nseSymbol}</strong></span>}
          {company.bseCode && <span>BSE: <strong className="text-slate-300">{company.bseCode}</strong></span>}
          {company.sector && <span>Sector: <strong className="text-slate-300">{company.sector}</strong></span>}
          {callDate && (
            <span className="flex items-center">
              <Calendar className="w-3.5 h-3.5 mr-1" />
              {callDate}
            </span>
          )}
        </div>

        {transcript && (
          <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap gap-4 text-xs text-slate-400">
            <span>Pages: <strong className="text-slate-300">{transcript.pageCount}</strong></span>
            <span>Character Count: <strong className="text-slate-300">{transcript.characterCount.toLocaleString()}</strong></span>
            <span>Extraction Method: <strong className="text-slate-300">{transcript.extractionMethod}</strong></span>
          </div>
        )}
      </div>

      {/* 1. Key Takeaways (TL;DR) */}
      {renderListSection('Key Takeaways (TL;DR)', <Target className="w-5 h-5 text-emerald-400" />, tldr)}

      {/* 2. Structured Key Metrics Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-6">
        <h3 className="text-base font-semibold text-white flex items-center mb-4">
          <LineChart className="w-5 h-5 text-sky-400 mr-2" />
          Key Financial Metrics
        </h3>
        {metrics.length === 0 ? (
          <p className="text-sm text-slate-400 italic">Not disclosed in transcript.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase bg-slate-950 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-4 font-semibold">Metric</th>
                  <th className="py-2.5 px-4 font-semibold">Value</th>
                  <th className="py-2.5 px-4 font-semibold">Context / Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                {metrics.map((m, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/40">
                    <td className="py-3 px-4 font-medium text-slate-200">{m.metric}</td>
                    <td className="py-3 px-4 font-bold text-emerald-400">{m.value}</td>
                    <td className="py-3 px-4 text-slate-400">{m.context}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 3. Management Commentary */}
      {renderListSection('Management Commentary', <Building2 className="w-5 h-5 text-blue-400" />, management)}

      {/* 4. Guidance & Outlook */}
      {renderListSection('Guidance & Future Outlook', <Target className="w-5 h-5 text-purple-400" />, guidance)}

      {/* 5. Segment Performance */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-6">
        <h3 className="text-base font-semibold text-white flex items-center mb-3">
          <Layers className="w-5 h-5 text-indigo-400 mr-2" />
          Segment Performance
        </h3>
        {segments.length === 0 ? (
          <p className="text-sm text-slate-400 italic">Not disclosed in transcript.</p>
        ) : (
          <div className="space-y-3">
            {segments.map((seg, idx) => (
              <div key={idx} className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80">
                <h4 className="text-sm font-semibold text-slate-200">{seg.segment}</h4>
                <p className="text-xs text-slate-400 mt-1">{seg.notes}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 6. Notable Q&A */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-6">
        <h3 className="text-base font-semibold text-white flex items-center mb-4">
          <MessageSquare className="w-5 h-5 text-amber-400 mr-2" />
          Notable Analyst Q&A
        </h3>
        {qa.length === 0 ? (
          <p className="text-sm text-slate-400 italic">Not disclosed in transcript.</p>
        ) : (
          <div className="space-y-4">
            {qa.map((item, idx) => {
              const hasAskedBy =
                item.asked_by &&
                item.asked_by.trim().length > 0 &&
                !item.asked_by.includes('Not disclosed');

              return (
                <div key={idx} className="p-4 rounded-lg bg-slate-950/60 border border-slate-800/80 space-y-2">
                  <div className="flex items-start gap-2">
                    <HelpCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-slate-200">{item.question}</p>
                      {hasAskedBy && (
                        <p className="text-xs text-amber-400/90 mt-0.5">Asked by: {item.asked_by}</p>
                      )}
                    </div>
                  </div>
                  <div className="pl-6 border-l-2 border-slate-700 text-xs text-slate-300">
                    <p className="font-semibold text-slate-400 mb-1">Answer:</p>
                    <p className="leading-relaxed">{item.answer}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 7. Key Risks */}
      {renderListSection('Key Risks & Headwinds', <AlertTriangle className="w-5 h-5 text-rose-400" />, risks)}

      {/* Raw Markdown view accordion */}
      {summary.summaryMarkdown && (
        <details className="bg-slate-900 border border-slate-800 rounded-xl p-5 text-xs text-slate-400">
          <summary className="font-semibold cursor-pointer text-slate-300 hover:text-white flex items-center">
            <FileText className="w-4 h-4 mr-2 text-slate-400" />
            View Generated Markdown Source
          </summary>
          <pre className="mt-4 p-4 bg-slate-950 rounded-lg overflow-x-auto text-slate-300 font-mono text-xs whitespace-pre-wrap leading-relaxed border border-slate-800">
            {summary.summaryMarkdown}
          </pre>
        </details>
      )}
    </div>
  );
};
