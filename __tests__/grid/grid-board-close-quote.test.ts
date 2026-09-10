import {
  compareCloseToAnchor,
  extractEtfCode,
  formatCloseMonthDay,
  formatDistancePct,
  pickLatestAwaitingSellPrice,
  pickNearestUnboughtBuyPrice,
} from '@/lib/grid/grid-board-close-quote';
import type { GridStrategyTrade } from '@/types/grid-strategy-trade';

function trade(
  partial: Partial<GridStrategyTrade> & Pick<GridStrategyTrade, 'id' | 'levelKey' | 'side'>
): GridStrategyTrade {
  return {
    strategyId: 's1',
    price: 1,
    qty: 100,
    tradeDate: '2026-09-01',
    createdAt: '2026-09-01T10:00:00.000Z',
    ...partial,
  };
}

describe('grid-board-close-quote', () => {
  it('extractEtfCode 取开头 6 位数字', () => {
    expect(extractEtfCode('159938')).toBe('159938');
    expect(extractEtfCode(' 159938 ')).toBe('159938');
    expect(extractEtfCode('沪深300')).toBeNull();
    expect(extractEtfCode('')).toBeNull();
  });

  it('formatCloseMonthDay 用交易日 MM-DD', () => {
    expect(formatCloseMonthDay('2026-09-09')).toBe('09-09');
  });

  it('未买档取离收盘最近的买价', () => {
    const levels = [
      { levelKey: 'a', buyPrice: 0.65, sellPrice: 0.68, awaitingSell: true },
      { levelKey: 'b', buyPrice: 0.62, sellPrice: 0.65, awaitingSell: false },
      { levelKey: 'c', buyPrice: 0.59, sellPrice: 0.62, awaitingSell: false },
    ];
    expect(pickNearestUnboughtBuyPrice(0.636, levels)).toBe(0.62);
  });

  it('收盘已破未买档时仍取绝对值最近的未买买价', () => {
    const levels = [
      { levelKey: 'b', buyPrice: 0.62, sellPrice: 0.65, awaitingSell: false },
      { levelKey: 'c', buyPrice: 0.5, sellPrice: 0.53, awaitingSell: false },
    ];
    expect(pickNearestUnboughtBuyPrice(0.6, levels)).toBe(0.62);
  });

  it('待卖档取最后买入的那档卖价', () => {
    const levels = [
      { levelKey: 'hi', buyPrice: 0.65, sellPrice: 0.714, awaitingSell: true },
      { levelKey: 'lo', buyPrice: 0.62, sellPrice: 0.683, awaitingSell: true },
    ];
    const trades = [
      trade({
        id: '1',
        levelKey: 'hi',
        side: 'buy',
        createdAt: '2026-09-01T10:00:00.000Z',
      }),
      trade({
        id: '2',
        levelKey: 'lo',
        side: 'buy',
        createdAt: '2026-09-08T10:00:00.000Z',
      }),
    ];
    expect(pickLatestAwaitingSellPrice(levels, trades)).toBe(0.683);
  });

  it('无买入时间时待卖取买入价最低档的卖价', () => {
    const levels = [
      { levelKey: 'hi', buyPrice: 0.65, sellPrice: 0.714, awaitingSell: true },
      { levelKey: 'lo', buyPrice: 0.62, sellPrice: 0.683, awaitingSell: true },
    ];
    expect(pickLatestAwaitingSellPrice(levels, [])).toBe(0.683);
  });

  it('compareCloseToAnchor 高于再跌、低于再涨', () => {
    expect(compareCloseToAnchor(0.636, 0.62)).toEqual({
      kind: 'down',
      pct: (0.636 - 0.62) / 0.636,
    });
    expect(compareCloseToAnchor(0.6, 0.62).kind).toBe('up');
    expect(compareCloseToAnchor(0.62, 0.62).kind).toBe('flat');
    expect(formatDistancePct((0.636 - 0.62) / 0.636)).toBe('2.5%');
  });
});
