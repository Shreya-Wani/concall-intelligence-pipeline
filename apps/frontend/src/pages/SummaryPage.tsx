import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ErrorState } from '../components/ErrorState';
import { Header } from '../components/Header';
import { LoadingState } from '../components/LoadingState';
import { SummaryDetail } from '../components/SummaryDetail';
import { getSummary } from '../services/api';
import { wsClient } from '../services/websocket';
import { SummaryDetail as SummaryDetailType } from '../types/api';
import { WsConnectionState } from '../types/websocket';
import { ArrowLeft } from 'lucide-react';

export const SummaryPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [summary, setSummary] = useState<SummaryDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [wsState, setWsState] = useState<WsConnectionState>('disconnected');

  const fetchDetail = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getSummary(id);
      setSummary(data);
    } catch (err: any) {
      if (err.response && err.response.status === 404) {
        setError('The requested summary was not found in the system.');
      } else {
        setError('Unable to load summary details from backend API.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();

    const unsubscribeState = wsClient.subscribeState((newState) => {
      setWsState(newState);
    });

    wsClient.connect();

    return () => {
      unsubscribeState();
    };
  }, [id]);

  return (
    <div className="min-h-screen bg-[#f0f7ff] text-slate-900 pb-12">
      <Header wsState={wsState} />

      <div className="max-w-4xl mx-auto px-4 mb-6">
        <Link
          to="/"
          className="inline-flex items-center text-xs font-bold text-[#0078d4] hover:text-[#005a9e] transition-colors bg-white px-3.5 py-2 rounded-lg border border-blue-200 shadow-sm"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Back to Dashboard
        </Link>
      </div>


      <main className="max-w-7xl mx-auto px-4 sm:px-6">
        {loading ? (
          <LoadingState message="Loading earnings call summary..." />
        ) : error ? (
          <ErrorState title="Summary Error" message={error} onRetry={fetchDetail} />
        ) : summary ? (
          <SummaryDetail summary={summary} />
        ) : (
          <ErrorState title="Not Found" message="Summary record could not be retrieved." />
        )}
      </main>
    </div>
  );
};

