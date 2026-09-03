import React from 'react';
import { AlertCircle } from 'lucide-react';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Unable to load data',
  message = 'Failed to fetch information from the backend API. Please ensure the backend server is running.',
  onRetry,
}) => {
  return (
    <div className="bg-rose-950/40 border border-rose-900/60 rounded-xl p-6 my-4 text-rose-200">
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
        <div>
          <h4 className="font-semibold text-rose-300">{title}</h4>
          <p className="text-sm text-rose-300/80 mt-1">{message}</p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="mt-3 px-3 py-1.5 bg-rose-900/80 hover:bg-rose-800 text-rose-100 text-xs font-medium rounded-md transition-colors"
            >
              Retry Connection
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
