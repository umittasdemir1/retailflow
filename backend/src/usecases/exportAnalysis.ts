import type { ExportRequest } from '@retailflow/shared';
import { buildExcelReport } from '../services/excelExporter';
import { runAnalysis } from './runAnalysis';
import { sessionStore } from '../store/sessionStore';

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
