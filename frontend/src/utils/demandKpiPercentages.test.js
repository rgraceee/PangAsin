import { describe, expect, it } from 'vitest';
import { getDemandKpiPercentages } from './demandKpiPercentages';

describe('getDemandKpiPercentages', () => {
  it('calculates complementary shares from the two displayed KPI amounts', () => {
    const shares = getDemandKpiPercentages(34192.05, 14981.79);

    expect(shares).toEqual({ shortfall: 69.5, production: 30.5 });
    expect(shares.shortfall + shares.production).toBe(100);
  });

  it('assigns the full share to production when no salt is needed', () => {
    expect(getDemandKpiPercentages(0, 14981.79)).toEqual({
      shortfall: 0,
      production: 100,
    });
  });

  it('returns no percentages when neither KPI has a positive amount', () => {
    expect(getDemandKpiPercentages(0, 0)).toEqual({
      shortfall: null,
      production: null,
    });
  });
});
