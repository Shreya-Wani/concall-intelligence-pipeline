import React, { useEffect, useState } from 'react';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import { Header } from '../components/Header';
import { LoadingState } from '../components/LoadingState';
import { PipelineStatus } from '../components/PipelineStatus';
import { SummaryCard } from '../components/SummaryCard';
import { getCompanies, getSummaries } from '../services/api';
import { wsClient } from '../services/websocket';
import { Company, SummaryListItem } from '../types/api';
import { PipelineEventItem, WsConnectionState } from '../types/websocket';
import { Building2, Sparkles } from 'lucide-react';

export const Dashboard: React.FC = () => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [summaries, setSummaries] = useState<SummaryListItem[]>([]);
  const [events, setEvents] = useState<PipelineEventItem[]>([]);
  const [wsState, setWsState] = useState<WsConnectionState>('disconnected');

  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [loadingSummaries, setLoadingSummaries] = useState(true);

  const [errorCompanies, setErrorCompanies] = useState<string | null>(null);
  const [errorSummaries, setErrorSummaries] = useState<string | null>(null);

  const fetchCompaniesData = async () => {
    setLoadingCompanies(true);
    setErrorCompanies(null);
    try {
      const data = await getCompanies();
      setCompanies(data);
    } catch (err: any) {
      setErrorCompanies('Unable to load company records from backend API.');
    } finally {
      setLoadingCompanies(false);
    }
  };

  const fetchSummariesData = async () => {
    setLoadingSummaries(true);
    setErrorSummaries(null);
    try {
      const res = await getSummaries();
      setSummaries(res.items);
    } catch (err: any) {
      setErrorSummaries('Unable to load summaries from backend API.');
    } finally {
      setLoadingSummaries(false);
    }
  };

  useEffect(() => {
    fetchCompaniesData();
    fetchSummariesData();

    // 1. Subscribe to WebSocket connection state
    const unsubscribeState = wsClient.subscribeState((newState) => {
      setWsState(newState);
    });

    // 2. Subscribe to WebSocket pipeline events
    const unsubscribeEvents = wsClient.subscribeEvents((event) => {
      setEvents((prev) => [event, ...prev].slice(0, 30));

      // Key requirement: When summary.completed event is received, refetch GET /api/summaries
      if (event.type === 'summary.completed') {
        console.log('[DASHBOARD] summary.completed event received. Refetching summaries list...');
        fetchSummariesData();
      }
    });

    // Connect WebSocket
    wsClient.connect();

    return () => {
      unsubscribeState();
      unsubscribeEvents();
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-12">
      <Header wsState={wsState} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 space-y-8">
        {/* A. Companies Section */}
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-white flex items-center">
              <Building2 className="w-4 h-4 mr-2 text-blue-400" />
              Monitored Listed Companies ({companies.length})
            </h2>
          </div>

          {loadingCompanies ? (
            <LoadingState message="Loading company master data..." />
          ) : errorCompanies ? (
            <ErrorState title="Companies Error" message={errorCompanies} onRetry={fetchCompaniesData} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 uppercase font-semibold border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Company Name</th>
                    <th className="py-2.5 px-3">NSE Symbol</th>
                    <th className="py-2.5 px-3">BSE Code</th>
                    <th className="py-2.5 px-3">ISIN</th>
                    <th className="py-2.5 px-3">Sector</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 text-slate-300">
                  {companies.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-2.5 px-3 font-semibold text-slate-200">{c.name}</td>
                      <td className="py-2.5 px-3 font-mono text-blue-400">{c.nseSymbol || '-'}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-400">{c.bseCode || '-'}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-400">{c.isin || '-'}</td>
                      <td className="py-2.5 px-3 text-slate-400">{c.sector || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Main Content Grid: Summaries + Pipeline Status */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* B. Recent Summaries Section (2 Cols) */}
          <section className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white flex items-center">
                <Sparkles className="w-5 h-5 mr-2 text-emerald-400" />
                Recent AI Earnings Summaries
              </h2>
              <span className="text-xs text-slate-400">{summaries.length} summaries</span>
            </div>

            {loadingSummaries ? (
              <LoadingState message="Loading earnings summaries..." />
            ) : errorSummaries ? (
              <ErrorState title="Summaries Error" message={errorSummaries} onRetry={fetchSummariesData} />
            ) : summaries.length === 0 ? (
              <EmptyState
                title="No summaries available yet."
                message="The unattended watcher is actively monitoring official NSE & BSE corporate announcements. As earnings call transcripts are filed, real-time summaries will appear here automatically."
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {summaries.map((summary) => (
                  <SummaryCard key={summary.id} summary={summary} />
                ))}
              </div>
            )}
          </section>

          {/* C. Real-time Pipeline Status (1 Col) */}
          <section className="lg:col-span-1">
            <PipelineStatus events={events} />
          </section>
        </div>
      </main>
    </div>
  );
};
