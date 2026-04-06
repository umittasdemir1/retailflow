import type { AnalysisResult, AnalyzeRequest } from '@retailflow/shared';
import { runTransferAnalysis } from '../services/transferEngine';
import { sessionStore } from '../store/sessionStore';

export function runAnalysis(request: AnalyzeRequest): AnalysisResult {
  const state = sessionStore.get();
  if (state.data === null) {
    throw new Error('Once veri yukleyin');
  }

  if (request.transferType !== 'global') {
    if (request.targetStore == null || request.targetStore.length === 0) {
      throw new Error('Gecerli bir hedef magaza secin');
    }

    if (!state.stores.includes(request.targetStore)) {
      throw new Error('Gecerli bir hedef magaza secin');
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
