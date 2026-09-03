import React from 'react';
import { WsConnectionState } from '../types/websocket';

interface HeaderProps {
  wsState: WsConnectionState;
}

export const Header: React.FC<HeaderProps> = ({ wsState }) => {
  const getBadge = () => {
    switch (wsState) {
      case 'connected':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-300">
            <span className="w-2 h-2 mr-1.5 bg-emerald-500 rounded-full animate-pulse" />
            Live Stream Connected
          </span>
        );
      case 'connecting':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-300">
            <span className="w-2 h-2 mr-1.5 bg-amber-500 rounded-full animate-ping" />
            Connecting...
          </span>
        );
      case 'disconnected':
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-800 border border-rose-300">
            <span className="w-2 h-2 mr-1.5 bg-rose-500 rounded-full" />
            Disconnected — retrying...
          </span>
        );
    }
  };

  return (
    <header className="bg-slate-900 border-b border-slate-800 py-4 px-6 mb-6">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Concall Intelligence Pipeline</h1>
          <p className="text-sm text-slate-400">Real-time NSE & BSE Earnings Call Intelligence & AI Summarization</p>
        </div>
        <div>{getBadge()}</div>
      </div>
    </header>
  );
};
