import type { RetailFlowStrategy, StrategyConfig } from './types.js';

export const STRATEGY_CONFIGS: Record<RetailFlowStrategy, StrategyConfig> = {
  sakin: {
    name: 'sakin',
    label: 'Calm',
    description: 'Safe and conservative transfer approach',
    minSourceDOS: 14,
    maxReceiverDOS: 7,
    minInventory: 3,
    maxTransfer: 5,
    deadStockStrThreshold: 0.15,
  },
  kontrollu: {
    name: 'kontrollu',
    label: 'Controlled',
    description: 'Balanced risk and performance',
    minSourceDOS: 10,
    maxReceiverDOS: 5,
    minInventory: 2,
    maxTransfer: 10,
    deadStockStrThreshold: 0.10,
  },
  agresif: {
    name: 'agresif',
    label: 'Aggressive',
    description: 'Maximum performance-focused',
    minSourceDOS: 7,
    maxReceiverDOS: 3,
    minInventory: 1,
    maxTransfer: null,
    deadStockStrThreshold: 0.08,
  },
  custom: {
    name: 'custom',
    label: 'Custom',
    description: 'User-defined parameters',
    minSourceDOS: 10,
    maxReceiverDOS: 5,
    minInventory: 2,
    maxTransfer: 10,
    deadStockStrThreshold: 0.10,
  },
};

export const DEFAULT_PRIORITY_SOURCES = new Set(['Merkez Depo', 'Online']);
export const DEFAULT_STRATEGY: RetailFlowStrategy = 'sakin';
export const MAX_FILE_SIZE_MB = 100;
export const MAX_ROW_COUNT = 1_000_000;
