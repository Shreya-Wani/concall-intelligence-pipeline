import React from 'react';
import { FileText } from 'lucide-react';

interface EmptyStateProps {
  title?: string;
  message?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title = 'No summaries available yet.',
  message = 'The unattended watcher is actively monitoring official NSE & BSE corporate announcements. As earnings call transcripts are filed, real-time summaries will appear here automatically.',
}) => {
  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-8 text-center my-4">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-800 text-slate-400 mb-3">
        <FileText className="w-6 h-6" />
      </div>
      <h3 className="text-lg font-semibold text-slate-200 mb-1">{title}</h3>
      <p className="text-sm text-slate-400 max-w-md mx-auto">{message}</p>
    </div>
  );
};
