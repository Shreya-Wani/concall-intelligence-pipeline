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
    <div className="bg-white border border-blue-200/80 rounded-xl p-5 mb-6 shadow-sm">
      <h3 className="text-base font-extrabold text-blue-950 flex items-center mb-3">
        {icon}
        <span className="ml-2">{title}</span>
      </h3>
      {items.length === 0 || (items.length === 1 && items[0].includes('Not disclosed')) ? (
        <p className="text-sm text-slate-500 italic">Not disclosed in transcript.</p>
      ) : (
        <ul className="space-y-2 text-sm text-slate-700">
          {items.map((item, idx) => (
            <li key={idx} className="flex items-start">
              <span className="text-[#0078d4] font-bold mr-2">•</span>
              <span className="leading-relaxed">{item}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Banner */}
      <div className="bg-white border border-blue-200/80 rounded-xl p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-[#0078d4] text-white text-xs font-extrabold rounded-md shadow-xs">
              {quarter}
            </span>
            <span className="px-2.5 py-1 bg-blue-50 text-blue-900 border border-blue-200 text-xs font-semibold rounded-md">
              Source: {source}
            </span>
          </div>
          <span className="text-xs text-slate-500 font-mono">Model: {model}</span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-extrabold text-blue-950 mb-2">{company.name}</h1>

        <div className="flex flex-wrap gap-4 text-xs text-slate-500">
          {company.nseSymbol && <span>NSE: <strong className="text-[#0078d4] font-bold">{company.nseSymbol}</strong></span>}
          {company.bseCode && <span>BSE: <strong className="text-slate-700">{company.bseCode}</strong></span>}
          {company.sector && <span>Sector: <strong className="text-slate-700">{company.sector}</strong></span>}
          {callDate && (
            <span className="flex items-center">
              <Calendar className="w-3.5 h-3.5 mr-1 text-[#0078d4]" />
              {callDate}
            </span>
          )}
        </div>

        {transcript && (
          <div className="mt-4 pt-3 border-t border-blue-100 flex flex-wrap gap-4 text-xs text-slate-500">
            <span>Pages: <strong className="text-slate-800">{transcript.pageCount}</strong></span>
            <span>Character Count: <strong className="text-slate-800">{transcript.characterCount.toLocaleString()}</strong></span>
            <span>Extraction Method: <strong className="text-slate-800">{transcript.extractionMethod}</strong></span>
          </div>
        )}
      </div>

      {/* 1. Key Takeaways (TL;DR) */}
      {renderListSection('Key Takeaways (TL;DR)', <Target className="w-5 h-5 text-emerald-600" />, tldr)}

      {/* 2. Structured Key Metrics Table */}
      <div className="bg-white border border-blue-200/80 rounded-xl p-5 mb-6 shadow-sm">
        <h3 className="text-base font-extrabold text-blue-950 flex items-center mb-4">
          <LineChart className="w-5 h-5 text-[#0078d4] mr-2" />
          Key Financial Metrics
        </h3>
        {metrics.length === 0 ? (
          <p className="text-sm text-slate-500 italic">Not disclosed in transcript.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-blue-100">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase bg-blue-50 text-blue-900 border-b border-blue-200 font-bold">
                <tr>
                  <th className="py-2.5 px-4">Metric</th>
                  <th className="py-2.5 px-4">Value</th>
                  <th className="py-2.5 px-4">Context / Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-blue-100 text-slate-700 bg-white">
                {metrics.map((m, idx) => (
                  <tr key={idx} className="hover:bg-blue-50/50">
                    <td className="py-3 px-4 font-bold text-slate-900">{m.metric}</td>
                    <td className="py-3 px-4 font-extrabold text-[#0078d4]">{m.value}</td>
                    <td className="py-3 px-4 text-slate-600 font-medium">{m.context}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 3. Management Commentary */}
      <div className="bg-white border border-blue-200/80 rounded-xl p-5 mb-6 shadow-sm">
        <h3 className="text-base font-extrabold text-blue-950 flex items-center mb-3">
          <Building2 className="w-5 h-5 text-[#0078d4] mr-2" />
          Management Commentary & Tone
        </h3>
        {summaryJson?.management_tone && (
          <div className="mb-3.5 p-3 rounded-lg bg-blue-50 border border-blue-200 text-xs font-bold text-blue-900 flex items-center">
            <span className="text-[#0078d4] font-extrabold uppercase tracking-wide mr-2 text-[11px] bg-white px-2 py-0.5 rounded border border-blue-200 shadow-2xs">
              Management Tone:
            </span>
            <span>{summaryJson.management_tone}</span>
          </div>
        )}
        {management.length === 0 ? (
          <p className="text-sm text-slate-500 italic">Not disclosed in transcript.</p>
        ) : (
          <ul className="space-y-2 text-sm text-slate-700">
            {management.map((item, idx) => (
              <li key={idx} className="flex items-start">
                <span className="text-[#0078d4] font-bold mr-2">•</span>
                <span className="leading-relaxed">{item}</span>
              </li>
            ))}
          </ul>
        )}
      </div>


      {/* 4. Guidance & Outlook */}
      {renderListSection('Guidance & Future Outlook', <Target className="w-5 h-5 text-indigo-600" />, guidance)}

      {/* 5. Segment Performance */}
      <div className="bg-white border border-blue-200/80 rounded-xl p-5 mb-6 shadow-sm">
        <h3 className="text-base font-extrabold text-blue-950 flex items-center mb-3">
          <Layers className="w-5 h-5 text-sky-600 mr-2" />
          Segment Performance
        </h3>
        {segments.length === 0 ? (
          <p className="text-sm text-slate-500 italic">Not disclosed in transcript.</p>
        ) : (
          <div className="space-y-3">
            {segments.map((seg, idx) => (
              <div key={idx} className="p-3.5 rounded-lg bg-blue-50/50 border border-blue-100">
                <h4 className="text-sm font-bold text-blue-950">{seg.segment}</h4>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">{seg.notes}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 6. Notable Q&A */}
      <div className="bg-white border border-blue-200/80 rounded-xl p-5 mb-6 shadow-sm">
        <h3 className="text-base font-extrabold text-blue-950 flex items-center mb-4">
          <MessageSquare className="w-5 h-5 text-amber-600 mr-2" />
          Notable Analyst Q&A
        </h3>
        {qa.length === 0 ? (
          <p className="text-sm text-slate-500 italic">Not disclosed in transcript.</p>
        ) : (
          <div className="space-y-4">
            {qa.map((item, idx) => {
              const hasAskedBy =
                item.asked_by &&
                item.asked_by.trim().length > 0 &&
                !item.asked_by.includes('Not disclosed');

              return (
                <div key={idx} className="p-4 rounded-lg bg-blue-50/50 border border-blue-100 space-y-2">
                  <div className="flex items-start gap-2">
                    <HelpCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-blue-950">{item.question}</p>
                      {hasAskedBy && (
                        <p className="text-xs font-bold text-amber-800 mt-0.5">Asked by: {item.asked_by}</p>
                      )}
                    </div>
                  </div>
                  <div className="pl-6 border-l-2 border-[#0078d4] text-xs text-slate-700">
                    <p className="font-bold text-slate-600 mb-1">Answer:</p>
                    <p className="leading-relaxed">{item.answer}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 7. Key Risks */}
      {renderListSection('Key Risks & Headwinds', <AlertTriangle className="w-5 h-5 text-rose-600" />, risks)}

      {/* Raw Markdown view accordion */}
      {summary.summaryMarkdown && (
        <details className="bg-white border border-blue-200/80 rounded-xl p-5 text-xs text-slate-600 shadow-sm">
          <summary className="font-bold cursor-pointer text-blue-950 hover:text-[#0078d4] flex items-center">
            <FileText className="w-4 h-4 mr-2 text-[#0078d4]" />
            View Generated Markdown Source
          </summary>
          <pre className="mt-4 p-4 bg-slate-900 rounded-lg overflow-x-auto text-slate-100 font-mono text-xs whitespace-pre-wrap leading-relaxed border border-slate-800">
            {summary.summaryMarkdown}
          </pre>
        </details>
      )}
    </div>
  );
};


