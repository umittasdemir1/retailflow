import type { RetailFlowStrategy, StrategyConfig } from './types';

export const STRATEGY_CONFIGS: Record<RetailFlowStrategy, StrategyConfig> = {
  sakin: {
    name: 'sakin',
    label: 'Sakin',
    description: 'Guvenli ve kontrollu transfer yaklasimi',
    minStrDiff: 0.15,
    minInventory: 3,
    maxTransfer: 5,
    targetCoverDays: 14,
    minCoverDays: 7,
    maxTransferPct: 0.25,
  },
  kontrollu: {
    name: 'kontrollu',
    label: 'Kontrollu',
    description: 'Dengeli risk ve performans',
    minStrDiff: 0.1,
    minInventory: 2,
    maxTransfer: 10,
    targetCoverDays: 10,
    minCoverDays: 5,
    maxTransferPct: 0.4,
  },
  agresif: {
    name: 'agresif',
    label: 'Agresif',
    description: 'Maksimum performans odakli',
    minStrDiff: 0.08,
    minInventory: 1,
    maxTransfer: null,
    targetCoverDays: 7,
    minCoverDays: 3,
    maxTransferPct: 0.6,
  },
};

export const DEFAULT_PRIORITY_SOURCES = new Set(['Merkez Depo', 'Online']);
export const DEFAULT_STRATEGY: RetailFlowStrategy = 'sakin';
export const MAX_FILE_SIZE_MB = 100;
export const MAX_ROW_COUNT = 1_000_000;
