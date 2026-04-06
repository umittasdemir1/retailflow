import type { TransferSimulation } from '@retailflow/shared';
import { sessionStore } from '../store/sessionStore';

export function simulateTransfers(): TransferSimulation {
  const analysis = sessionStore.get().currentAnalysis;
  if (analysis === null) {
    throw new Error('No analysis found to simulate');
  }

  return analysis.simulation;
}
