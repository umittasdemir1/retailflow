import type { AnalysisResult, AnalyzeRequest } from '@retailflow/shared';
import { runTransferAnalysis } from '../services/transferEngine.js';
import { runAllocationAnalysis } from '../services/allocationEngine.js';
import { computeStoreMetrics } from '../services/storeMetrics.js';
import { sessionStore } from '../store/sessionStore.js';

export function runAnalysis(request: AnalyzeRequest): AnalysisResult {
  const state = sessionStore.get();
  if (state.data === null) {
    throw new Error('Upload data first');
  }

  const excludedStores = (request.excludedStores ?? []).filter((store) => state.stores.includes(store));

  if (request.transferType === 'allocation') {
    const result = runAllocationAnalysis(state.data, request.analysisDays ?? 30, excludedStores);
    sessionStore.setAnalysis(result);
    return result;
  }

  if (request.transferType !== 'global') {
    if (request.targetStore == null || request.targetStore.length === 0) {
      throw new Error('Select a valid target store');
    }

    if (!state.stores.includes(request.targetStore)) {
      throw new Error('Select a valid target store');
    }
  }

  const normalizedRequest: AnalyzeRequest = { ...request, excludedStores };

  const storeMetrics = request.analysisDays != null
    ? computeStoreMetrics(state.data, undefined, request.analysisDays)
    : state.storeMetrics;

  const result = runTransferAnalysis(state.data, normalizedRequest, storeMetrics);
  sessionStore.setAnalysis(result);
  return result;
}
