import { Router } from 'express';
import { STRATEGY_CONFIGS } from '@retailflow/shared';
import { sessionStore } from '../store/sessionStore';
import { getMemoryUsagePercent } from '../utils/system';

export const healthRouter = Router();

healthRouter.get('/', (_req, res) => {
  const state = sessionStore.get();
  const currentAnalysis = state.currentAnalysis;

  res.json({
    ok: true,
    status: 'healthy',
    service: 'RetailFlow Transfer API',
    version: '6.1.0-monorepo',
    timestamp: new Date().toISOString(),
    dataLoaded: Boolean(state.data?.length),
    storeCount: state.stores.length,
    currentStrategy: currentAnalysis?.strategy ?? 'sakin',
    transferType: currentAnalysis?.analysisType ?? 'global',
    targetStore: currentAnalysis?.targetStore ?? null,
    excludedStores: currentAnalysis?.excludedStores ?? [],
    availableStrategies: Object.keys(STRATEGY_CONFIGS),
    memoryUsagePercent: getMemoryUsagePercent(),
    performanceMetrics: currentAnalysis?.performance ?? {},
  });
});
