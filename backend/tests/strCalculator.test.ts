import { describe, expect, it } from 'vitest';
import { computeCoverDays, computeStr } from '../src/services/strCalculator';

describe('strCalculator', () => {
  it('computes STR', () => {
    expect(computeStr(10, 10)).toBe(0.5);
  });

  it('computes cover days', () => {
    expect(computeCoverDays(30, 3)).toBe(10);
  });
});
