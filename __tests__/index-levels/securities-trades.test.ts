import { SECURITIES_ETF_TRADES } from '@/lib/index-levels/securities-etf-trades';
import { SECURITIES_LINK_TRADES } from '@/lib/index-levels/securities-link-trades';

describe('512880 买卖点', () => {
  it('收益有值的是卖出，其余是买入，日期不重复', () => {
    const dates = SECURITIES_ETF_TRADES.map(mark => mark.tradeDate);
    expect(new Set(dates).size).toBe(dates.length);
    expect(SECURITIES_ETF_TRADES.filter(mark => mark.side === 'buy')).toHaveLength(10);
    expect(SECURITIES_ETF_TRADES.filter(mark => mark.side === 'sell')).toHaveLength(10);
    expect(SECURITIES_ETF_TRADES.find(mark => mark.tradeDate === '2021-03-15')).toMatchObject({
      side: 'buy',
      price: 1.03,
    });
    expect(SECURITIES_ETF_TRADES.find(mark => mark.tradeDate === '2026-06-22')).toMatchObject({
      side: 'sell',
      price: 1.132,
    });
    expect(SECURITIES_ETF_TRADES.find(mark => mark.tradeDate === '2024-10-08')?.price).toBe(1.218);
  });
});

describe('502010 发车买卖点', () => {
  it('发车记录里写明的买卖各 4 笔', () => {
    const dates = SECURITIES_LINK_TRADES.map(mark => mark.tradeDate);
    expect(new Set(dates).size).toBe(dates.length);
    expect(SECURITIES_LINK_TRADES.filter(mark => mark.side === 'buy')).toHaveLength(4);
    expect(SECURITIES_LINK_TRADES.filter(mark => mark.side === 'sell')).toHaveLength(4);
    expect(SECURITIES_LINK_TRADES.find(mark => mark.tradeDate === '2017-12-14')).toMatchObject({
      side: 'buy',
      price: 1.0944,
    });
    expect(SECURITIES_LINK_TRADES.find(mark => mark.tradeDate === '2026-06-25')).toMatchObject({
      side: 'sell',
      price: 1.3281,
    });
  });
});
