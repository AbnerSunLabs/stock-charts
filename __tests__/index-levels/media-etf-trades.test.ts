import { formatHoverClose } from '@/lib/index-levels/close-series';
import { buyPointNote, MEDIA_ETF_TRADES, withTradeMarks } from '@/lib/index-levels/media-etf-trades';

describe('512980 买卖点', () => {
  it('收益有值的是卖出，其余是买入，日期不重复', () => {
    const dates = MEDIA_ETF_TRADES.map(mark => mark.tradeDate);
    expect(new Set(dates).size).toBe(dates.length);
    expect(MEDIA_ETF_TRADES.filter(mark => mark.side === 'buy')).toHaveLength(22);
    expect(MEDIA_ETF_TRADES.filter(mark => mark.side === 'sell')).toHaveLength(24);
    expect(MEDIA_ETF_TRADES.find(mark => mark.tradeDate === '2026-11-05')?.side).toBe('sell');
    expect(MEDIA_ETF_TRADES.find(mark => mark.tradeDate === '2026-10-08')?.side).toBe('buy');
    expect(MEDIA_ETF_TRADES.find(mark => mark.tradeDate === '2025-09-16')?.price).toBe(1.055);
  });

  it('买入带当日滚动市盈率，间隔跳过中间的卖出', () => {
    const buys = MEDIA_ETF_TRADES.filter(mark => mark.side === 'buy');
    expect(buys.every(mark => typeof mark.peTtm === 'number')).toBe(true);
    expect(MEDIA_ETF_TRADES.filter(mark => mark.side === 'sell').every(mark => mark.peTtm == null)).toBe(true);
    expect(buyPointNote(MEDIA_ETF_TRADES, '2020-12-16')).toEqual({ peTtm: 24.82, gapLabel: '首笔' });
    expect(buyPointNote(MEDIA_ETF_TRADES, '2021-07-28')).toEqual({ peTtm: 17.89, gapLabel: '2 天' });
    expect(buyPointNote(MEDIA_ETF_TRADES, '2021-11-29')).toEqual({ peTtm: 21.01, gapLabel: '33 天' });
    expect(buyPointNote(MEDIA_ETF_TRADES, '2022-04-25')).toEqual({ peTtm: 15.48, gapLabel: '48 天' });
    expect(buyPointNote(MEDIA_ETF_TRADES, '2021-09-08')).toBeNull();
  });

  it('成交日对到收盘日，悬停收盘保留三位小数', () => {
    const points = [
      { tradeDate: '2026-11-04', close: 0.84 },
      { tradeDate: '2026-11-05', close: 0.8512 },
    ];
    const marked = withTradeMarks(points, [
      { tradeDate: '2026-11-05', side: 'sell', price: 0.852 },
      { tradeDate: '2026-11-07', side: 'buy', price: 0.9 },
    ]);
    expect(marked[1]).toMatchObject({ tradeSide: 'sell', tradePrice: 0.852 });
    expect(marked[0]).toMatchObject({ tradeSide: 'buy', tradePrice: 0.9 });
    expect(formatHoverClose(0.8512, 3)).toBe('0.851');
    expect(formatHoverClose(1170.88)).toBe('1170.88');
  });
});
