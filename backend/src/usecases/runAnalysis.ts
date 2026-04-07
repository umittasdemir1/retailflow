import type { AnalysisResult, AnalyzeRequest } from '@retailflow/shared';
import { runTransferAnalysis } from '../services/transferEngine.js';
import { sessionStore } from '../store/sessionStore.js';

export function runAnalysis(request: AnalyzeRequest): AnalysisResult {
  const state = sessionStore.get();
  if (state.data === null) {
    throw new Error('Önce veri yükleyin');
  }

  if (request.transferType !== 'global') {
    if (request.targetStore == null || request.targetStore.length === 0) {
      throw new Error('Geçerli bir hedef mağaza seçin');
    }

    if (!state.stores.includes(request.targetStore)) {
      throw new Error('Geçerli bir hedef mağaza seçin');
    }
  }

  const excludedStores = (request.excludedStores ?? []).filter((store) => state.stores.includes(store));
  const normalizedRequest: AnalyzeRequest = {
    ...request,
    excludedStores,
  };

  const result = runTransferAnalysis(state.data, normalizedRequest, state.storeMetrics);
  sessionStore.setAnalysis(result);
  return result;
}
