import { parseCmbUsdQuotes } from '@/lib/index-levels/cmb-fx';

describe('招行美元牌价', () => {
  it('把 100 美元牌价换成 1 美元，并按日期排好汇买和汇卖', () => {
    const quotes = parseCmbUsdQuotes([
      { ratDat: '2026年11月07日', rthBid: '665.508', rthOfr: '669.746' },
      { ratDat: '2026-11-06', rthBid: 666.115, rthOfr: 669.018 },
    ]);

    expect(quotes.bid).toEqual([
      { tradeDate: '2026-11-06', close: 6.66115 },
      { tradeDate: '2026-11-07', close: 6.65508 },
    ]);
    expect(quotes.ask).toEqual([
      { tradeDate: '2026-11-06', close: 6.69018 },
      { tradeDate: '2026-11-07', close: 6.69746 },
    ]);
  });

  it('丢掉缺日期或牌价的行', () => {
    const quotes = parseCmbUsdQuotes([
      { ratDat: '2026-11-07', rthBid: '665.508' },
      { rthBid: '665.508', rthOfr: '669.746' },
      { ratDat: '不是日期', rthBid: '665.508', rthOfr: '669.746' },
      null,
    ]);

    expect(quotes.bid).toEqual([{ tradeDate: '2026-11-07', close: 6.65508 }]);
    expect(quotes.ask).toEqual([]);
  });

  it('同一天以后来的那条为准', () => {
    const quotes = parseCmbUsdQuotes([
      { ratDat: '2026-11-07', rthBid: '660.000', rthOfr: '664.000' },
      { ratDat: '2026-11-07', rthBid: '665.508', rthOfr: '669.746' },
    ]);

    expect(quotes.bid).toEqual([{ tradeDate: '2026-11-07', close: 6.65508 }]);
    expect(quotes.ask).toEqual([{ tradeDate: '2026-11-07', close: 6.69746 }]);
  });
});
