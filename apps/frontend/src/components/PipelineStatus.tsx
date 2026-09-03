import React from 'react';
import { PipelineEventItem } from '../types/websocket';
import { Activity, AlertTriangle, CheckCircle2, Download, FileText, Sparkles } from 'lucide-react';

interface PipelineStatusProps {
  events: PipelineEventItem[];
}

export const PipelineStatus: React.FC<PipelineStatusProps> = ({ events }) => {
  const getEventIcon = (type: string) => {
    switch (type) {
      case 'filing.discovered':
        return <Activity className="w-4 h-4 text-[#0078d4]" />;
      case 'filing.downloaded':
        return <Download className="w-4 h-4 text-sky-600" />;
      case 'transcript.extracted':
        return <FileText className="w-4 h-4 text-indigo-600" />;
      case 'summary.completed':
        return <Sparkles className="w-4 h-4 text-emerald-600" />;
      case 'pipeline.error':
        return <AlertTriangle className="w-4 h-4 text-rose-600" />;
      default:
        return <CheckCircle2 className="w-4 h-4 text-slate-400" />;
    }
  };

  const formatEventText = (event: PipelineEventItem) => {
    const { type, data } = event;
    const company = data.companyName || 'Corporate Announcement';

    switch (type) {
      case 'filing.discovered':
        return `Discovered ${data.source || ''} filing for ${company} (${data.announcementId || ''})`;
      case 'filing.downloaded':
        return `Downloaded transcript PDF for ${company} (SHA-256: ${data.pdfHash?.slice(0, 8) || 'verified'})`;
      case 'transcript.extracted':
        return `Extracted ${data.characterCount?.toLocaleString() || 'clean'} chars (${data.pageCount || 1} pages) for ${company}`;
      case 'summary.completed':
        return `Generated AI Summary for ${company} (${data.quarter || 'Q1 FY26'}) via ${data.model || 'LLM'}`;
      case 'pipeline.error':
        return `[${data.stage || 'pipeline'}] ${company}: ${data.errorMessage || 'Processing issue'}`;
      default:
        return `Event ${type} received for ${company}`;
    }
  };

  return (
    <div className="bg-white border border-blue-200/80 rounded-xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-extrabold text-blue-950 flex items-center">
          <Activity className="w-4 h-4 mr-2 text-[#0078d4]" />
          Live Pipeline Activity Stream
        </h3>
        <span className="text-xs font-bold text-[#0078d4] bg-blue-50 px-2.5 py-0.5 rounded border border-blue-200">
          {events.length} events
        </span>
      </div>

      {events.length === 0 ? (
        <div className="text-center py-6 text-xs text-slate-600 border border-dashed border-blue-200 rounded-lg bg-blue-50/40">
          Waiting for live pipeline events... Watcher is actively polling NSE & BSE endpoints.
        </div>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {events.map((ev) => (
            <div
              key={ev.id}
              className="flex items-start gap-2.5 p-2.5 rounded-lg bg-blue-50/60 border border-blue-100 text-xs"
            >
              <div className="shrink-0 mt-0.5">{getEventIcon(ev.type)}</div>
              <div className="flex-1 min-w-0">
                <p className="text-slate-800 font-bold leading-tight">{formatEventText(ev)}</p>
                <p className="text-[10px] text-slate-500 mt-0.5 font-medium">
                  {new Date(ev.timestamp).toLocaleTimeString()} • <span className="font-mono text-[#0078d4] font-semibold">{ev.type}</span>
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};


