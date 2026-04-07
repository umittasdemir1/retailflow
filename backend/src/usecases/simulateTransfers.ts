import type { TransferSimulation } from '@retailflow/shared';
import { sessionStore } from '../store/sessionStore.js';

export function simulateTransfers(): TransferSimulation {
  const analysis = sessionStore.get().currentAnalysis;
  if (analysis === null) {
    throw new Error('Simülasyon için analiz bulunamadı');
  }

  return analysis.simulation;
}
