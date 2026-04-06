import type { AnalyzeRequest, ExportRequest, RetailFlowStrategy, TransferType } from '@retailflow/shared';

const validStrategies: RetailFlowStrategy[] = ['sakin', 'kontrollu', 'agresif'];
const validTransferTypes: TransferType[] = ['global', 'targeted', 'size_completion'];

export function validateAnalyzeRequest(input: Partial<AnalyzeRequest>): AnalyzeRequest {
  const strategy = validStrategies.includes(input.strategy as RetailFlowStrategy) ? (input.strategy as RetailFlowStrategy) : 'sakin';
  const transferType = validTransferTypes.includes(input.transferType as TransferType)
    ? (input.transferType as TransferType)
    : 'global';

  return {
    strategy,
    transferType,
    targetStore: input.targetStore,
    excludedStores: Array.isArray(input.excludedStores) ? input.excludedStores : [],
    prioritySources: Array.isArray(input.prioritySources) ? input.prioritySources : [],
    analysisDays: typeof input.analysisDays === 'number' ? input.analysisDays : undefined,
  };
}

export function validateExportRequest(input: Partial<ExportRequest>): ExportRequest {
  const analyzed = validateAnalyzeRequest(input);
  return {
    strategy: analyzed.strategy,
    transferType: analyzed.transferType,
    targetStore: analyzed.targetStore,
    excludedStores: analyzed.excludedStores,
    prioritySources: analyzed.prioritySources,
  };
}
