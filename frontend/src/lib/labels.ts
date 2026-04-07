import type { RetailFlowStrategy, TransferSimulation, TransferType } from '@retailflow/shared';

const TRANSFER_TYPE_LABELS: Record<TransferType, string> = {
  global: 'Global',
  targeted: 'Hedefli',
  size_completion: 'Beden Tamamlama',
};

const STRATEGY_LABELS: Record<RetailFlowStrategy, string> = {
  sakin: 'Sakin',
  kontrollu: 'Kontrollü',
  agresif: 'Agresif',
};

const RISK_LEVEL_LABELS: Record<TransferSimulation['riskLevel'], string> = {
  LOW: 'Düşük',
  MEDIUM: 'Orta',
  HIGH: 'Yüksek',
};

export function formatTransferTypeLabel(value: TransferType | string): string {
  return value in TRANSFER_TYPE_LABELS
    ? TRANSFER_TYPE_LABELS[value as TransferType]
    : value;
}

export function formatStrategyLabel(value: RetailFlowStrategy | string): string {
  return value in STRATEGY_LABELS
    ? STRATEGY_LABELS[value as RetailFlowStrategy]
    : value;
}

export function formatRiskLevelLabel(value: TransferSimulation['riskLevel'] | string): string {
  return value in RISK_LEVEL_LABELS
    ? RISK_LEVEL_LABELS[value as TransferSimulation['riskLevel']]
    : value;
}
