import { useEffect, useState } from 'react';
import { HealthResponse } from '@concall/shared';
import { fetchHealth } from '../services/api';

export interface HealthState {
  health: HealthResponse | null;
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  lastChecked: Date | null;
}

export function useHealth(pollIntervalMs = 10000): HealthState & { refetch: () => Promise<void> } {
  const [state, setState] = useState<HealthState>({
    health: null,
    isConnected: false,
    isLoading: true,
    error: null,
    lastChecked: null,
  });

  const checkHealth = async () => {
    setState((prev) => ({ ...prev, isLoading: true }));
    try {
      const healthData = await fetchHealth();
      setState({
        health: healthData,
        isConnected: healthData.status === 'ok',
        isLoading: false,
        error: null,
        lastChecked: new Date(),
      });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Network Error';
      setState({
        health: null,
        isConnected: false,
        isLoading: false,
        error: errorMessage,
        lastChecked: new Date(),
      });
    }
  };

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, pollIntervalMs);
    return () => clearInterval(interval);
  }, [pollIntervalMs]);

  return { ...state, refetch: checkHealth };
}
