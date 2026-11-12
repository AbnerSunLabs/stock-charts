import { parseFundNavScript } from '@/lib/index-levels/fund-nav';
import { MEDIA_LINK_TRADES } from '@/lib/index-levels/media-link-trades';

describe('004752 单位净值', () => {
  it('按上海日期解析单位净值', () => {
    const script = 'var Data_netWorthTrend = [{"x":1514822400000,"y":1,"equityReturn":0},{"x":1793808000000,"y":0.8479,"equityReturn":3.45}];';
    expect(parseFundNavScript(script)).toEqual([
      { tradeDate: '2018-01-02', close: 1 },
      { tradeDate: '2026-11-05', close: 0.8479 },
    ]);
    expect(parseFundNavScript('var other = [];')).toEqual([]);
  });

  it('发车记录与且慢列表一致，买卖各 7 笔', () => {
    expect(MEDIA_LINK_TRADES.filter(mark => mark.side === 'buy')).toHaveLength(7);
    expect(MEDIA_LINK_TRADES.filter(mark => mark.side === 'sell')).toHaveLength(7);
    expect(MEDIA_LINK_TRADES.find(mark => mark.tradeDate === '2018-01-19')).toMatchObject({
      side: 'buy',
      price: 0.9959,
    });
    expect(MEDIA_LINK_TRADES.find(mark => mark.tradeDate === '2018-11-30')).toBeUndefined();
    expect(MEDIA_LINK_TRADES.find(mark => mark.tradeDate === '2025-08-22')).toMatchObject({
      side: 'sell',
      price: 0.9836,
    });
    expect(MEDIA_LINK_TRADES.find(mark => mark.tradeDate === '2026-01-15')).toMatchObject({
      side: 'sell',
      price: 1.2422,
    });
  });
});
