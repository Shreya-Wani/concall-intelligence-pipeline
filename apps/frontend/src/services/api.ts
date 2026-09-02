import axios from 'axios';
import { HealthResponse } from '@concall/shared';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 5000,
});

export async function fetchHealth(): Promise<HealthResponse> {
  const response = await api.get<HealthResponse>('/api/health');
  return response.data;
}
