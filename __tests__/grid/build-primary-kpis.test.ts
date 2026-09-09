import { buildPrimaryKpis } from '@/components/grid/build-primary-kpis';
import type { StressTest } from '@/types/grid';

describe('buildPrimaryKpis', () => {
  it('returns four V2 primary KPI cards', () => {
    const stressTest: StressTest = {
      totalBuyAmount: 100,
      totalBuyShares: 0,
      totalSellAmount: 0,
      totalSellShares: 0,
      remainingShares: 0,
      profit: 0,
      profitRate: 0,
      v2: {
        totalBudget: 500000,
        amountPerGrid: 10000,
        totalBudgetRequired: 400000,
        budgetUsageRate: 0.8,
        maxClusterCashDemand: 10000,
        totalBuyShares: 0,
        totalSellShares: 0,
        realizedGridProfit: 1234,
        realizedGridProfitRate: 1.25,
        basePositionShares: 100,
        basePositionCost: 1000,
        basePositionMarketValue: 1050,
        basePositionUnrealizedPnL: 50,
        totalNetProfit: 1284,
        totalNetProfitRate: 0.3,
        totalCommission: 10,
        totalSlippageCost: 5,
        costCoverageStepPct: 0.1,
      },
    };

    const items = buildPrimaryKpis(stressTest);

    expect(items).toHaveLength(4);
    expect(items.map(item => item.label)).toEqual([
      '预计最大投入',
      '最大单档聚合资金',
      '推演网格利润',
      '单格金额',
    ]);
    expect(items[0].value).toBe('400,000');
    expect(items[1].value).toBe('10,000');
    expect(items[2].value).toBe('+1,234');
    expect(items[2].color).toBe('var(--profit)');
    expect(items[3].value).toBe('10,000');
  });

  it('returns legacy primary cards without inventing V2 fields', () => {
    const stressTest: StressTest = {
      totalBuyAmount: 20000,
      totalBuyShares: 1000,
      totalSellAmount: 21000,
      totalSellShares: 800,
      remainingShares: 200,
      profit: 1500,
      profitRate: 7.5,
    };

    const items = buildPrimaryKpis(stressTest);

    expect(items.map(item => item.label)).toEqual([
      '总买入金额',
      '收益率',
      '预期利润',
    ]);
    expect(items[0].value).toBe('20,000');
    expect(items[1].value).toBe('+7.5%');
    expect(items[2].value).toBe('+1,500');
  });
});
