import type { RetailFlowStrategy, TransferSimulation, TransferType } from '@retailflow/shared';

const TRANSFER_TYPE_LABELS: Record<TransferType, string> = {
  global: 'Global',
  targeted: 'Targeted',
  size_completion: 'Size Completion',
  allocation: 'Tahsisat',
};

const STRATEGY_LABELS: Record<RetailFlowStrategy, string> = {
  sakin: 'Calm',
  kontrollu: 'Controlled',
  agresif: 'Aggressive',
  custom: 'Custom',
};

const RISK_LEVEL_LABELS: Record<TransferSimulation['riskLevel'], string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
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
