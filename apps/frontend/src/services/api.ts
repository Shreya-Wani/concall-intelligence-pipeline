import { HealthResponse } from '@concall/shared';
import axios from 'axios';
import { Company, FilingDetail, SummariesResponse, SummaryDetail } from '../types/api';

const getEnvVar = (key: string, defaultVal: string): string => {
  if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
    return (import.meta as any).env[key] || defaultVal;
  }
  return typeof process !== 'undefined' && process.env ? process.env[key] || defaultVal : defaultVal;
};

const API_BASE_URL = getEnvVar('VITE_API_BASE_URL', 'http://localhost:3001');

const apiClient = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  timeout: 10000,
});

export async function fetchHealth(): Promise<HealthResponse> {
  const res = await apiClient.get<HealthResponse>('/health');
  return res.data;
}

export async function getCompanies(): Promise<Company[]> {
  const res = await apiClient.get<{ data: Company[] }>('/companies');
  return res.data.data;
}

export async function getSummaries(params?: {
  companyId?: string;
  source?: 'NSE' | 'BSE';
  limit?: number;
  offset?: number;
}): Promise<SummariesResponse> {
  const res = await apiClient.get<SummariesResponse>('/summaries', { params });
  return res.data;
}

export async function getSummary(id: string): Promise<SummaryDetail> {
  const res = await apiClient.get<{ data: SummaryDetail }>(`/summaries/${id}`);
  return res.data.data;
}

export async function getFiling(id: string): Promise<FilingDetail> {
  const res = await apiClient.get<{ data: FilingDetail }>(`/filings/${id}`);
  return res.data.data;
}
