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
    <div className="min-h-screen bg-[#f0f7ff] text-slate-900 pb-12">
      <Header wsState={wsState} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 space-y-8">
        {/* A. Companies Section */}
        <section className="bg-white border border-blue-200/80 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-extrabold text-blue-950 flex items-center">
              <Building2 className="w-5 h-5 mr-2 text-[#0078d4]" />
              Monitored Listed Companies ({companies.length})
            </h2>
          </div>

          {loadingCompanies ? (
            <LoadingState message="Loading company master data..." />
          ) : errorCompanies ? (
            <ErrorState title="Companies Error" message={errorCompanies} onRetry={fetchCompaniesData} />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-blue-100">
              <table className="w-full text-left text-xs">
                <thead className="bg-blue-50 text-blue-900 uppercase font-bold border-b border-blue-200">
                  <tr>
                    <th className="py-3 px-3.5">Company Name</th>
                    <th className="py-3 px-3.5">NSE Symbol</th>
                    <th className="py-3 px-3.5">BSE Code</th>
                    <th className="py-3 px-3.5">ISIN</th>
                    <th className="py-3 px-3.5">Sector</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-blue-100 text-slate-700 bg-white">
                  {companies.map((c) => (
                    <tr key={c.id} className="hover:bg-blue-50/60 transition-colors">
                      <td className="py-3 px-3.5 font-bold text-slate-900">{c.name}</td>
                      <td className="py-3 px-3.5 font-mono text-[#0078d4] font-bold">{c.nseSymbol || '-'}</td>
                      <td className="py-3 px-3.5 font-mono text-slate-500">{c.bseCode || '-'}</td>
                      <td className="py-3 px-3.5 font-mono text-slate-500">{c.isin || '-'}</td>
                      <td className="py-3 px-3.5 text-slate-600 font-medium">{c.sector || '-'}</td>
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
              <h2 className="text-lg font-extrabold text-blue-950 flex items-center">
                <Sparkles className="w-5 h-5 mr-2 text-[#0078d4]" />
                Recent AI Earnings Summaries
              </h2>
              <span className="text-xs font-bold text-[#0078d4] bg-blue-100/80 border border-blue-200 px-3 py-1 rounded-full shadow-xs">
                {summaries.length} summaries
              </span>
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


