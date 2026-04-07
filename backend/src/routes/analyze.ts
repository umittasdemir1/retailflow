import type { AnalysisResult } from '@retailflow/shared';
import { Router } from 'express';
import { runAnalysis } from '../usecases/runAnalysis.js';
import { validateAnalyzeRequest } from '../utils/validators.js';
import { getMemoryUsagePercent } from '../utils/system.js';

export const analyzeRouter = Router();

analyzeRouter.post('/', (req, res) => {
  try {
    const beforeAnalysis = getMemoryUsagePercent();
    const payload = validateAnalyzeRequest(req.body ?? {});
    const result = runAnalysis(payload);
    const afterAnalysis = getMemoryUsagePercent();

    res.json({
      success: true,
      results: buildAnalyzeResponse(result, beforeAnalysis, afterAnalysis),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const statusCode = isValidationError(message) ? 400 : 500;
    res.status(statusCode).json({ ok: false, error: message });
  }
});

function buildAnalyzeResponse(result: AnalysisResult, beforeAnalysis: number, afterAnalysis: number) {
  return {
    analysisType: result.analysisType,
    strategy: result.strategy,
    strategyConfig: result.strategyConfig,
    targetStore: result.targetStore,
    excludedStores: result.excludedStores,
    excludedCount: result.excludedStores.length,
    transfers: result.transfers.slice(0, 50),
    totalTransferCount: result.transfers.length,
    rejectedTransfers: result.rejectedTransfers.slice(0, 20),
    totalRejectedCount: result.rejectedTransfers.length,
    storeMetrics: result.storeMetrics,
    simulation: result.simulation,
    performance: result.performance,
    memoryUsage: {
      beforeAnalysis,
      afterAnalysis,
    },
  };
}

function isValidationError(message: string): boolean {
  return [
    'Once veri yukleyin',
    'Gecerli bir hedef magaza secin',
    'Targeted analiz icin hedef magaza gerekli',
    'Beden tamamlama icin hedef magaza gerekli',
  ].includes(message);
}
