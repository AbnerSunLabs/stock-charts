import {
  assertSellWithinOpenQty,
  computeLevelTradeQty,
  computeSellRealizedPnl,
  computeStrategyTradeStats,
  estimateMaxLoss,
} from '@/lib/grid/grid-strategy-trade-stats';
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
});
