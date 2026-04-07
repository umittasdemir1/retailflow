import type { ExportRequest } from '@retailflow/shared';
import { buildExcelReport } from '../services/excelExporter.js';
import { runAnalysis } from './runAnalysis.js';
import { sessionStore } from '../store/sessionStore.js';

export async function exportAnalysis(request: ExportRequest): Promise<Buffer> {
  const current = sessionStore.get().currentAnalysis;
  const result = current ?? runAnalysis({
    strategy: request.strategy,
    transferType: request.transferType,
    targetStore: request.targetStore,
    excludedStores: request.excludedStores,
    prioritySources: request.prioritySources,
  });

  return buildExcelReport(result);
}
