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
        return <Activity className="w-4 h-4 text-blue-400" />;
      case 'filing.downloaded':
        return <Download className="w-4 h-4 text-sky-400" />;
      case 'transcript.extracted':
        return <FileText className="w-4 h-4 text-purple-400" />;
      case 'summary.completed':
        return <Sparkles className="w-4 h-4 text-emerald-400" />;
      case 'pipeline.error':
        return <AlertTriangle className="w-4 h-4 text-rose-400" />;
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
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-white flex items-center">
          <Activity className="w-4 h-4 mr-2 text-blue-400" />
          Live Pipeline Activity Stream
        </h3>
        <span className="text-xs text-slate-400">{events.length} recent events</span>
      </div>

      {events.length === 0 ? (
        <div className="text-center py-6 text-xs text-slate-400 border border-dashed border-slate-800 rounded-lg">
          Waiting for live pipeline events... Watcher is actively polling NSE & BSE endpoints.
        </div>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {events.map((ev) => (
            <div
              key={ev.id}
              className="flex items-start gap-2.5 p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80 text-xs"
            >
              <div className="shrink-0 mt-0.5">{getEventIcon(ev.type)}</div>
              <div className="flex-1 min-w-0">
                <p className="text-slate-200 font-medium leading-tight">{formatEventText(ev)}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {new Date(ev.timestamp).toLocaleTimeString()} • <span className="font-mono">{ev.type}</span>
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
