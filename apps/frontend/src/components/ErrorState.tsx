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
    <div className="bg-rose-50 border border-rose-200 rounded-xl p-6 my-4 text-rose-900 shadow-sm">
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
        <div>
          <h4 className="font-bold text-rose-900">{title}</h4>
          <p className="text-sm text-rose-700 mt-1">{message}</p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="mt-3 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-md transition-colors shadow-sm"
            >
              Retry Connection
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

