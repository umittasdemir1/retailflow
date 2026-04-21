import { describe, expect, it } from 'vitest';
import { computeCoverDays, computeDOS, computeStr, computeDOSBasedTransfer, checkTransferConditions } from '../src/services/strCalculator.js';
import type { StrategyConfig } from '@retailflow/shared';

const SAKIN: StrategyConfig = {
  name: 'sakin', label: 'Calm', description: '',
  minSourceDOS: 14, maxReceiverDOS: 7, minInventory: 3, maxTransfer: 5, deadStockStrThreshold: 0.15,
};

describe('strCalculator', () => {
  it('computes STR', () => {
    expect(computeStr(10, 10)).toBe(0.5);
  });

  it('computes cover days', () => {
    expect(computeCoverDays(30, 3)).toBe(10);
  });

  it('computeDOS returns null when velocity is zero', () => {
    expect(computeDOS(50, 0)).toBeNull();
  });

  it('computeDOS returns correct days', () => {
    expect(computeDOS(30, 3)).toBe(10);
  });

  it('rejects when sender inventory at or below minInventory', () => {
    const result = checkTransferConditions(10, 3, 10, 1, SAKIN);
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain('Kaynak stok yetersiz');
  });

  it('rejects when sender DOS is below minSourceDOS', () => {
    // sender: 14 sales/30 days = 0.467/day, 5 inv → DOS = 5/0.467 = ~10.7 days < 14
    const result = checkTransferConditions(14, 5, 10, 0, SAKIN, 30);
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain('Kaynak kapama günü yetersiz');
  });

  it('rejects when receiver DOS is above maxReceiverDOS', () => {
    // receiver: 2 sales/30 days = 0.067/day, 10 inv → DOS = 10/0.067 = ~150 days ≥ 7
    const result = checkTransferConditions(0, 20, 2, 10, SAKIN, 30);
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain('Alıcı kapama günü yeterli');
  });

  it('allows transfer from warehouse (zero velocity) to urgent receiver', () => {
    // sender: warehouse, 0 sales, 20 inv → DOS = null (infinite), skip minSourceDOS check
    // receiver: 10 sales/30 days = 0.333/day, 1 inv → DOS = 3 days < 7 ✓
    const result = checkTransferConditions(0, 20, 10, 1, SAKIN, 30);
    expect(result.eligible).toBe(true);
  });

  it('computeDOSBasedTransfer caps at maxTransfer', () => {
    // warehouse → urgent store, maxTransfer=5 should be the binding constraint
    const transfer = computeDOSBasedTransfer(0, 20, 10, 1, SAKIN, 30);
    expect(transfer.quantity).toBe(5);
    expect(transfer.appliedFilter).toBe('Maks. 5 adet');
  });

  it('computeDOSBasedTransfer respects source protection', () => {
    // sender: 10 sales/30d = 0.333/day, 8 inv → DOS = 24 days
    // minSourceDOS=14 → must keep ceil(14*0.333)=5 units → available = min(8-5, 8-3) = min(3,5) = 3
    // receiver: 10 sales/30d, 0 inv → DOS = 0
    // theoretical: totalVelocity = 0.667, equilibrium = 8/0.667 = 12d, needed = 12*0.333 - 0 = 4
    // available = 3 < 4 → source protection kicks in
    // maxTransfer = 5, so 3 is not capped
    const transfer = computeDOSBasedTransfer(10, 8, 10, 0, SAKIN, 30);
    expect(transfer.quantity).toBe(3);
    expect(transfer.appliedFilter).toContain('Kaynak koruma');
  });
});
