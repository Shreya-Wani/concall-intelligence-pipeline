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
    <div className="bg-white border border-blue-200/80 rounded-xl p-8 text-center my-4 shadow-sm">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-50 text-[#0078d4] mb-3 border border-blue-200">
        <FileText className="w-6 h-6" />
      </div>
      <h3 className="text-lg font-extrabold text-blue-950 mb-1">{title}</h3>
      <p className="text-sm text-slate-600 max-w-md mx-auto leading-relaxed font-medium">{message}</p>
    </div>
  );
};


