import {
  assertSellWithinOpenQty,
  computeLevelTradeQty,
  computeSellRealizedPnl,
  computeStrategyTradeStats,
  defaultSellQty,
  estimateMaxLoss,
  estimateMaxLossFromSnapshot,
  getLevelExecuteState,
} from '@/lib/grid/grid-strategy-trade-stats';
import type { StressTest } from '@/types/grid';
import type { GridStrategyTrade } from '@/types/grid-strategy-trade';

function trade(
  partial: Partial<GridStrategyTrade> &
    Pick<GridStrategyTrade, 'id' | 'side' | 'price' | 'qty'>
): GridStrategyTrade {
  return {
    strategyId: 's1',
    levelKey: 'L1',
    tradeDate: '2026-09-01',
    createdAt: `2026-09-01T0${partial.id.slice(-1)}:00:00.000Z`,
    ...partial,
  };
}

describe('grid-strategy-trade-stats', () => {
  it('无流水或仅买入时的执行列状态', () => {
    expect(getLevelExecuteState([])).toMatchObject({
      openQty: 0,
      rounds: 0,
      awaitingSell: false,
    });
    expect(
      getLevelExecuteState([trade({ id: '1', side: 'buy', price: 1, qty: 100 })])
    ).toMatchObject({
      openQty: 100,
      rounds: 0,
      awaitingSell: true,
    });
  });

  it('留利卖出后仍可再买：最后一笔是卖则不待卖', () => {
    const list = [
      trade({ id: '1', side: 'buy', price: 0.607, qty: 9100 }),
      trade({ id: '2', side: 'sell', price: 0.647, qty: 8500 }),
    ];
    const state = getLevelExecuteState(list);
    expect(state).toMatchObject({
      openQty: 600,
      rounds: 1,
      awaitingSell: false,
    });
    expect(defaultSellQty(9100, 8500)).toBe(8500);
    expect(defaultSellQty(600, 8500)).toBe(600);
  });

  it('买后 openQty 增加，卖后减少并计轮', () => {
    const list = [
      trade({ id: '1', side: 'buy', price: 1, qty: 100 }),
      trade({ id: '2', side: 'sell', price: 1.1, qty: 100 }),
      trade({ id: '3', side: 'buy', price: 0.9, qty: 50 }),
    ];
    expect(computeLevelTradeQty(list)).toEqual({
      openQty: 50,
      rounds: 1,
      occupiedCost: 45,
    });
  });

  it('FIFO 计算卖出盈亏', () => {
    const list = [
      trade({ id: '1', side: 'buy', price: 1, qty: 100 }),
      trade({ id: '2', side: 'sell', price: 1.2, qty: 100 }),
    ];
    expect(computeSellRealizedPnl(list, list[1])).toBeCloseTo(20);
  });

  it('卖出超量抛错', () => {
    const list = [trade({ id: '1', side: 'buy', price: 1, qty: 10 })];
    expect(() => assertSellWithinOpenQty(list, 'L1', 11)).toThrow(/不能超过持仓/);
  });

  it('策略汇总 openLevels 与 realized', () => {
    const trades = [
      trade({ id: '1', side: 'buy', price: 1, qty: 100, levelKey: 'A' }),
      trade({ id: '2', side: 'sell', price: 1.1, qty: 100, levelKey: 'A' }),
      trade({ id: '3', side: 'buy', price: 2, qty: 50, levelKey: 'B' }),
    ];
    const stats = computeStrategyTradeStats(trades, ['A', 'B', 'C']);
    expect(stats.openLevels).toBe(1);
    expect(stats.totalLevels).toBe(3);
    expect(stats.rounds).toBe(1);
    expect(stats.realized).toBeCloseTo(10);
    expect(stats.openShares).toBe(50);
  });

  it('预计最大亏损粗估', () => {
    expect(estimateMaxLoss(1000, 100, 5)).toBe(500);
  });

  it('看板亏损用保存快照的全仓股数而非底仓', () => {
    const stress: StressTest = {
      totalBuyAmount: 400000,
      totalBuyShares: 80000,
      totalSellAmount: 0,
      totalSellShares: 0,
      remainingShares: 5000,
      profit: 0,
      profitRate: 0,
      v2: {
        totalBudget: 0,
        amountPerGrid: 10000,
        totalBudgetRequired: 400000,
        budgetUsageRate: 0,
        maxClusterCashDemand: 0,
        totalBuyShares: 80000,
        totalSellShares: 0,
        realizedGridProfit: 0,
        realizedGridProfitRate: 0,
        basePositionShares: 5000,
        basePositionCost: 0,
        basePositionMarketValue: 0,
        basePositionUnrealizedPnL: 0,
        totalNetProfit: 0,
        totalNetProfitRate: 0,
        totalCommission: 0,
        totalSlippageCost: 0,
        costCoverageStepPct: 0,
      },
    };
    expect(estimateMaxLossFromSnapshot(stress, 0.5)).toBe(360000);
    expect(estimateMaxLossFromSnapshot(null, 0.5)).toBe(0);
  });
});
