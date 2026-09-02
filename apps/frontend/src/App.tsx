import React from 'react';
import { useHealth } from './hooks/useHealth';
import { Activity, Database, Server, RefreshCw, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';

export default function App() {
  const { health, isConnected, isLoading, error, lastChecked, refetch } = useHealth();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-6 md:p-12">
      <div className="max-w-4xl mx-auto w-full space-y-8">
        {/* Header */}
        <header className="border-b border-slate-800 pb-6 space-y-2">
          <div className="flex items-center space-[#000] space-x-3">
            <div className="p-2.5 bg-blue-600/20 text-blue-400 rounded-xl border border-blue-500/30">
              <Activity className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-white">
                Concall Intelligence
              </h1>
              <p className="text-slate-400 text-sm md:text-base">
                Real-time Indian earnings call intelligence
              </p>
            </div>
          </div>
        </header>

        {/* Main Status Panel */}
        <main className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Main Backend Status Card */}
          <div className="md:col-span-3 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Server className="w-6 h-6 text-slate-400" />
                <h2 className="text-lg font-semibold text-slate-200">Backend Connection</h2>
              </div>
              <button
                onClick={() => refetch()}
                disabled={isLoading}
                className="flex items-center space-x-2 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg border border-slate-700 transition duration-150 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>

            <div className="flex items-center space-x-4 pt-2">
              {isConnected ? (
                <div className="flex items-center space-x-3 bg-emerald-950/50 border border-emerald-500/30 text-emerald-400 px-4 py-3 rounded-xl w-full">
                  <CheckCircle2 className="w-6 h-6 shrink-0" />
                  <div>
                    <div className="font-bold text-lg">Backend: Connected</div>
                    <div className="text-xs text-emerald-500/80">Service: {health?.service || 'concall-intelligence-backend'}</div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center space-x-3 bg-rose-950/50 border border-rose-500/30 text-rose-400 px-4 py-3 rounded-xl w-full">
                  <XCircle className="w-6 h-6 shrink-0" />
                  <div>
                    <div className="font-bold text-lg">Backend: Disconnected</div>
                    <div className="text-xs text-rose-400/80">
                      {error ? `Error: ${error}` : 'Unable to connect to http://localhost:3001/api/health'}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {lastChecked && (
              <p className="text-xs text-slate-500 text-right">
                Last checked: {lastChecked.toLocaleTimeString()}
              </p>
            )}
          </div>

          {/* PostgreSQL Sub-status Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-3">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Database</span>
              <Database className="w-4 h-4" />
            </div>
            <div className="text-xl font-bold text-white">PostgreSQL</div>
            <div className="flex items-center space-x-2">
              {health?.db === 'connected' ? (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Connected
                </span>
              ) : (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
                  Disconnected
                </span>
              )}
            </div>
          </div>

          {/* Redis Sub-status Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-3">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Cache & Queue</span>
              <Server className="w-4 h-4" />
            </div>
            <div className="text-xl font-bold text-white">Redis</div>
            <div className="flex items-center space-x-2">
              {health?.redis === 'connected' ? (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Connected
                </span>
              ) : (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
                  Disconnected
                </span>
              )}
            </div>
          </div>

          {/* Infrastructure Info Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-3">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Phase 1 Status</span>
              <AlertTriangle className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-xl font-bold text-white">Foundation Ready</div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Monorepo setup, Express backend, Drizzle ORM, Redis, and React Vite frontend.
            </p>
          </div>
        </main>
      </div>

      <footer className="text-center text-xs text-slate-500 mt-12">
        Concall Intelligence Pipeline &bull; Phase 1 Foundation
      </footer>
    </div>
  );
}
