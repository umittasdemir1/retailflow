import type { AnalysisResult, InventoryRecord, StoreMetrics, UploadResult } from '@retailflow/shared';

export interface SessionData {
  data: InventoryRecord[] | null;
  stores: string[];
  currentAnalysis: AnalysisResult | null;
  storeMetrics: StoreMetrics[];
  uploadInfo: UploadResult | null;
}

const state: SessionData = {
  data: null,
  stores: [],
  currentAnalysis: null,
  storeMetrics: [],
  uploadInfo: null,
};

export const sessionStore = {
  get(): SessionData {
    return state;
  },
  setUpload(data: InventoryRecord[], stores: string[], storeMetrics: StoreMetrics[], uploadInfo: UploadResult): void {
    state.data = data;
    state.stores = stores;
    state.storeMetrics = storeMetrics;
    state.uploadInfo = uploadInfo;
    state.currentAnalysis = null;
  },
  setAnalysis(analysis: AnalysisResult): void {
    state.currentAnalysis = analysis;
  },
  clear(): void {
    state.data = null;
    state.stores = [];
    state.currentAnalysis = null;
    state.storeMetrics = [];
    state.uploadInfo = null;
  },
};
