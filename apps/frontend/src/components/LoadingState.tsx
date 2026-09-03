import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingStateProps {
  message?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({ message = 'Loading pipeline data...' }) => {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-blue-950">
      <Loader2 className="w-8 h-8 animate-spin text-[#0078d4] mb-3" />
      <p className="text-sm font-bold">{message}</p>
    </div>
  );
};


