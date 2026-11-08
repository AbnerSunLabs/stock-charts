import { CMB_USD_BUY_MARKS } from '@/lib/index-levels/cmb-fx-trades';

describe('招行购汇成交', () => {
  it('五笔买入标在汇卖价上，汇率按 1 美元计', () => {
    expect(CMB_USD_BUY_MARKS).toEqual([
      { tradeDate: '2026-01-21', side: 'buy', price: 6.9832 },
      { tradeDate: '2026-02-25', side: 'buy', price: 6.8904 },
      { tradeDate: '2026-04-08', side: 'buy', price: 6.846 },
      { tradeDate: '2026-05-12', side: 'buy', price: 6.8111 },
      { tradeDate: '2026-09-23', side: 'buy', price: 6.7236 },
    ]);
  });
});
