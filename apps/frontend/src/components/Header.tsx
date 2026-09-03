import React from 'react';
import { WsConnectionState } from '../types/websocket';
import { Radio } from 'lucide-react';

interface HeaderProps {
  wsState: WsConnectionState;
}

export const Header: React.FC<HeaderProps> = ({ wsState }) => {
  const getBadge = () => {
    switch (wsState) {
      case 'connected':
        return (
          <span className="inline-flex items-center px-3.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-100 border border-emerald-300/40 backdrop-blur-sm shadow-sm">
            <span className="w-2 h-2 mr-2 bg-emerald-400 rounded-full animate-pulse" />
            Live Stream Connected
          </span>
        );
      case 'connecting':
        return (
          <span className="inline-flex items-center px-3.5 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-100 border border-amber-300/40 backdrop-blur-sm shadow-sm">
            <span className="w-2 h-2 mr-2 bg-amber-400 rounded-full animate-ping" />
            Connecting...
          </span>
        );
      case 'disconnected':
      default:
        return (
          <span className="inline-flex items-center px-3.5 py-1 rounded-full text-xs font-semibold bg-rose-500/20 text-rose-100 border border-rose-300/40 backdrop-blur-sm shadow-sm">
            <span className="w-2 h-2 mr-2 bg-rose-400 rounded-full" />
            Disconnected — retrying...
          </span>
        );
    }
  };

  return (
    <header className="bg-gradient-to-r from-[#005a9e] via-[#0078d4] to-[#0284c7] text-white py-5 px-6 mb-8 shadow-md border-b border-blue-600">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-white/15 border border-white/25 text-white flex items-center justify-center shadow-inner shrink-0 backdrop-blur-sm">
            <Radio className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
              Concall Intelligence Pipeline
            </h1>
            <p className="text-xs text-blue-100 font-medium">Real-time NSE & BSE Earnings Call Intelligence & AI Summarization</p>
          </div>
        </div>
        <div>{getBadge()}</div>
      </div>
    </header>
  );
};


