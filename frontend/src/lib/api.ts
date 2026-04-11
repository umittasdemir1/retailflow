import axios from 'axios';
import type { AnalyzeRequest, RejectedTransfer, StrategyConfig, StoreMetrics, TransferSimulation, TransferSuggestion, UploadResult } from '@retailflow/shared';

export interface HealthResponse {
  ok: boolean;
  status: string;
  service: string;
  version: string;
  timestamp: string;
  dataLoaded: boolean;
  storeCount: number;
  currentStrategy: string;
  transferType: string;
  targetStore: string | null;
  excludedStores: string[];
  availableStrategies: string[];
  memoryUsagePercent: number;
  performanceMetrics: Record<string, unknown>;
}

export interface AnalyzeResponse {
  success: boolean;
  results: {
    analysisType: AnalyzeRequest['transferType'];
    strategy: AnalyzeRequest['strategy'];
    strategyConfig: StrategyConfig;
    targetStore: string | null;
    excludedStores: string[];
    excludedCount: number;
    transfers: TransferSuggestion[];
    totalTransferCount: number;
    rejectedTransfers: RejectedTransfer[];
    totalRejectedCount: number;
    storeMetrics: StoreMetrics[];
    simulation: TransferSimulation;
    performance: Record<string, unknown>;
    memoryUsage: {
      beforeAnalysis: number;
      afterAnalysis: number;
    };
  };
}

export interface SimulateResponse {
  success: boolean;
  impact: TransferSimulation;
}

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ? `${import.meta.env.VITE_API_BASE_URL}/api` : '/api',
});

export async function fetchHealth(): Promise<HealthResponse> {
  const response = await api.get<HealthResponse>('/health');
  return response.data;
}

export async function fetchStrategies(): Promise<StrategyConfig[]> {
  const response = await api.get<StrategyConfig[]>('/strategies');
  return response.data;
}

export async function fetchStores(): Promise<StoreMetrics[]> {
  const response = await api.get<StoreMetrics[]>('/stores');
  return response.data;
}

export async function uploadInventoryFile(file: File): Promise<UploadResult> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await api.post<UploadResult>('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
}

export async function analyzeInventory(payload: AnalyzeRequest): Promise<AnalyzeResponse> {
  const response = await api.post<AnalyzeResponse>('/analyze', payload);
  return response.data;
}

export async function exportExcel(payload: AnalyzeRequest): Promise<Blob> {
  const response = await api.post('/export/excel', payload, { responseType: 'blob' });
  return response.data;
}

export async function resetData(): Promise<void> {
  await api.delete('/data');
}

export async function simulateCurrentAnalysis(): Promise<SimulateResponse> {
  const response = await api.post<SimulateResponse>('/simulate');
  return response.data;
}

export interface ProductSummary {
  productCode: string;
  productName: string;
  imageUrl: string | null;
  colors: string[];
  sizes: string[];
  totalInventory: number;
  totalSales: number;
  totalReturns: number;
  str: number;
  strPercent: number;
  storeCount: number;
  variantCount: number;
  gender: string | null;
  stockStatus: 'KRITIK' | 'DUSUK' | 'NORMAL' | 'YUKSEK';
  price: number | null;
  category: string | null;
}

export interface ProductsResponse {
  products: ProductSummary[];
  stats: {
    totalProducts: number;
    totalSold: number;
    totalReturned: number;
    avgStrPercent: number;
    bestSeller: { productName: string; totalSales: number } | null;
  };
}

export async function fetchProducts(): Promise<ProductsResponse> {
  const response = await api.get<ProductsResponse>('/products');
  return response.data;
}
