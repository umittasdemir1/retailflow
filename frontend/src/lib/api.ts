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

function toApiError(error: unknown): Error {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data;
    const message =
      (typeof data?.error === 'string' && data.error) ||
      (typeof data?.message === 'string' && data.message) ||
      error.message;
    return new Error(message);
  }

  return error instanceof Error ? error : new Error('Bilinmeyen hata');
}

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

export type { ProductSummary, ProductsResponse } from '@retailflow/shared';
import type { ProductSummary, ProductsResponse } from '@retailflow/shared';

export async function fetchProducts(): Promise<ProductsResponse> {
  const response = await api.get<ProductsResponse>('/products');
  return response.data;
}

export type {
  VisionRecognizeResponse,
  VisionStatusResponse,
  CatalogProductPublic,
  RecognizedProduct,
  FoundLocation,
} from '@retailflow/shared';

export async function fetchVisionStatus(): Promise<import('@retailflow/shared').VisionStatusResponse> {
  try {
    const response = await api.get<import('@retailflow/shared').VisionStatusResponse>('/vision/status');
    return response.data;
  } catch (error) {
    throw toApiError(error);
  }
}

export async function fetchCatalog(): Promise<import('@retailflow/shared').CatalogProductPublic[]> {
  try {
    const response = await api.get<import('@retailflow/shared').CatalogProductPublic[]>('/vision/catalog');
    return response.data;
  } catch (error) {
    throw toApiError(error);
  }
}

export async function addCatalogProduct(
  images: File[],
  meta: { productCode: string; productName: string; color: string; provider?: VisionProvider },
): Promise<import('@retailflow/shared').CatalogProductPublic> {
  try {
    const formData = new FormData();
    images.forEach((img) => formData.append('images', img));
    formData.append('productCode', meta.productCode);
    formData.append('productName', meta.productName);
    formData.append('color', meta.color);
    if (meta.provider) formData.append('provider', meta.provider);
    const response = await api.post<import('@retailflow/shared').CatalogProductPublic>(
      '/vision/catalog',
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return response.data;
  } catch (error) {
    throw toApiError(error);
  }
}

export async function updateCatalogProduct(
  id: string,
  meta: { productCode?: string; productName?: string; color?: string; description?: string },
): Promise<import('@retailflow/shared').CatalogProductPublic> {
  try {
    const response = await api.patch<import('@retailflow/shared').CatalogProductPublic>(
      `/vision/catalog/${id}`,
      meta,
    );
    return response.data;
  } catch (error) {
    throw toApiError(error);
  }
}

export async function deleteCatalogProduct(id: string): Promise<void> {
  try {
    await api.delete(`/vision/catalog/${id}`);
  } catch (error) {
    throw toApiError(error);
  }
}

export function catalogImageUrl(id: string): string {
  const base = import.meta.env.VITE_API_BASE_URL ? `${import.meta.env.VITE_API_BASE_URL}/api` : '/api';
  return `${base}/vision/catalog/${id}/image`;
}

export type VisionProvider = 'python' | 'openai';

export interface ProductLookupEntry {
  productCode: string;
  productName: string;
  colorCode: string;
  color: string;
}

export async function searchProducts(q: string): Promise<ProductLookupEntry[]> {
  const response = await api.get<ProductLookupEntry[]>('/vision/product-search', { params: { q } });
  return response.data;
}

export async function addCatalogProductFromCdn(meta: {
  productCode: string;
  colorCode: string;
  productName: string;
  color: string;
  provider?: VisionProvider;
}): Promise<import('@retailflow/shared').CatalogProductPublic> {
  try {
    const response = await api.post<import('@retailflow/shared').CatalogProductPublic>(
      '/vision/catalog/cdn',
      meta,
    );
    return response.data;
  } catch (error) {
    throw toApiError(error);
  }
}

export async function recognizeShelf(
  image: File,
  provider: VisionProvider,
  calibrationId?: string,
  catalogProductIds?: string[],
): Promise<import('@retailflow/shared').VisionRecognizeResponse> {
  try {
    const formData = new FormData();
    formData.append('image', image);
    formData.append('provider', provider);
    if (calibrationId) formData.append('calibrationId', calibrationId);
    if (catalogProductIds && catalogProductIds.length > 0) {
      formData.append('catalogProductIds', JSON.stringify(catalogProductIds));
    }
    const response = await api.post<import('@retailflow/shared').VisionRecognizeResponse>(
      '/vision/recognize',
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return response.data;
  } catch (error) {
    throw toApiError(error);
  }
}

// ─── Calibration API ─────────────────────────────────────────────────────────

export type { StoreCalibration, CalibrationRect, CalibrationDot } from '@retailflow/shared';

export async function fetchCalibrations(): Promise<import('@retailflow/shared').StoreCalibration[]> {
  try {
    const response = await api.get<import('@retailflow/shared').StoreCalibration[]>('/calibration');
    return response.data;
  } catch (error) {
    throw toApiError(error);
  }
}

export async function saveCalibration(
  storeName: string,
  data: Omit<import('@retailflow/shared').StoreCalibration, 'id' | 'storeName' | 'createdAt' | 'updatedAt'>,
  image?: File,
): Promise<import('@retailflow/shared').StoreCalibration> {
  try {
    const formData = new FormData();
    formData.append('storeName', storeName);
    formData.append('data', JSON.stringify(data));
    if (image) formData.append('image', image);
    const response = await api.post<import('@retailflow/shared').StoreCalibration>(
      '/calibration',
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return response.data;
  } catch (error) {
    throw toApiError(error);
  }
}

export async function deleteCalibration(id: string): Promise<void> {
  try {
    await api.delete(`/calibration/${id}`);
  } catch (error) {
    throw toApiError(error);
  }
}

export function calibrationImageUrl(id: string): string {
  const base = import.meta.env.VITE_API_BASE_URL ? `${import.meta.env.VITE_API_BASE_URL}/api` : '/api';
  return `${base}/calibration/${id}/image`;
}

// ─── Allocation API ──────────────────────────────────────────────────────────

export type { Series, AssortmentRule, StoreAllocation } from '@retailflow/shared';
import type { Series, AssortmentRule, StoreAllocation } from '@retailflow/shared';

export async function fetchSeries(): Promise<Series[]> {
  const r = await api.get<{ ok: boolean; data: Series[] }>('/allocation/series');
  return r.data.data;
}

export async function createSeries(data: { name: string; sizes: Record<string, number> }): Promise<Series> {
  const r = await api.post<{ ok: boolean; data: Series }>('/allocation/series', data);
  return r.data.data;
}

export async function updateSeries(id: string, data: Partial<{ name: string; sizes: Record<string, number> }>): Promise<Series> {
  const r = await api.put<{ ok: boolean; data: Series }>(`/allocation/series/${id}`, data);
  return r.data.data;
}

export async function deleteSeries(id: string): Promise<void> {
  await api.delete(`/allocation/series/${id}`);
}

export async function fetchAssortmentRules(): Promise<AssortmentRule[]> {
  const r = await api.get<{ ok: boolean; data: AssortmentRule[] }>('/allocation/assortment');
  return r.data.data;
}

export async function createAssortmentRule(data: { type: 'product' | 'category'; targetName: string; seriesId: string }): Promise<AssortmentRule> {
  const r = await api.post<{ ok: boolean; data: AssortmentRule }>('/allocation/assortment', data);
  return r.data.data;
}

export async function deleteAssortmentRule(id: string): Promise<void> {
  await api.delete(`/allocation/assortment/${id}`);
}

export async function fetchAllocations(): Promise<StoreAllocation[]> {
  const r = await api.get<{ ok: boolean; data: StoreAllocation[] }>('/allocation/allocations');
  return r.data.data;
}

export async function createAllocation(data: Omit<StoreAllocation, 'id' | 'createdAt'>): Promise<StoreAllocation> {
  const r = await api.post<{ ok: boolean; data: StoreAllocation }>('/allocation/allocations', data);
  return r.data.data;
}

export async function updateAllocation(id: string, data: Partial<Omit<StoreAllocation, 'id' | 'createdAt'>>): Promise<StoreAllocation> {
  const r = await api.put<{ ok: boolean; data: StoreAllocation }>(`/allocation/allocations/${id}`, data);
  return r.data.data;
}

export async function deleteAllocation(id: string): Promise<void> {
  await api.delete(`/allocation/allocations/${id}`);
}

export async function bulkUpsertAllocations(items: Omit<StoreAllocation, 'id' | 'createdAt'>[]): Promise<StoreAllocation[]> {
  const r = await api.post<{ ok: boolean; data: StoreAllocation[] }>('/allocation/allocations/bulk', { items });
  return r.data.data;
}

export interface SizeTemplate {
  year: number | null;
  productName: string;
  color: string;
  sizes: string[];
}

export async function fetchSizeTemplates(): Promise<{ data: SizeTemplate[]; uploaded: boolean }> {
  const r = await api.get<{ ok: boolean; data: SizeTemplate[]; uploaded: boolean }>('/size-templates');
  return { data: r.data.data, uploaded: r.data.uploaded };
}

export async function applyAssortmentRules(): Promise<{ applied: number; skipped: number }> {
  const r = await api.post<{ ok: boolean; applied: number; skipped: number }>('/allocation/apply-rules');
  return { applied: r.data.applied, skipped: r.data.skipped };
}
