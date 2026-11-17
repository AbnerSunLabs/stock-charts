import { A500_ETF_TRADES } from '@/lib/index-levels/a500-etf-trades';
import { A500_LINK_TRADES } from '@/lib/index-levels/a500-link-trades';
import { INDEX_WATCHES } from '@/lib/index-levels/catalog';
import { journalTradesToMarks, resolveEtfChartMarks } from '@/lib/index-levels/etf-journal-marks';

describe('中证A500', () => {
  it('跟踪 000510，场内 563360，场外 022424', () => {
    const watch = INDEX_WATCHES.find(item => item.code === '000510.SH');
    expect(watch?.name).toBe('中证A500');
    expect(watch?.chartEtf).toMatchObject({ code: '563360', name: '华泰柏瑞中证A500ETF' });
    expect(watch?.chartFund).toMatchObject({
      code: '022424',
      name: '广发中证A500ETF联接A',
      href: 'https://qieman.com/longwin/funds/022424?prodCode=LONG_WIN',
    });
    expect(watch?.levels).toEqual([]);
  });

  it('已登录时 563360 只用标的对得上的流水，同一天后一笔排在后面', () => {
    const marks = journalTradesToMarks(
      [
        { id: 'a500', symbol: '563360' },
        { id: 'media', symbol: '512980' },
      ],
      [
        { strategyId: 'media', tradeDate: '2026-01-01', price: 0.8, side: 'buy', createdAt: '1' },
        { strategyId: 'a500', tradeDate: '2026-10-15', price: 1.146, side: 'buy', createdAt: '2' },
        { strategyId: 'a500', tradeDate: '2026-09-29', price: 1.1, side: 'buy', createdAt: '1' },
        { strategyId: 'a500', tradeDate: '2026-09-29', price: 1.207, side: 'buy', createdAt: '2' },
      ],
      '563360'
    );
    expect(marks).toEqual([
      { tradeDate: '2026-09-29', price: 1.1, side: 'buy' },
      { tradeDate: '2026-09-29', price: 1.207, side: 'buy' },
      { tradeDate: '2026-10-15', price: 1.146, side: 'buy' },
    ]);
    expect(resolveEtfChartMarks('563360', { status: 'live', marks }, A500_ETF_TRADES)).toEqual(marks);
    expect(resolveEtfChartMarks('563360', { status: 'signed-out' }, A500_ETF_TRADES)).toEqual(A500_ETF_TRADES);
    expect(resolveEtfChartMarks('512980', { status: 'live', marks: [] }, [{ tradeDate: '2020-12-16', price: 0.86, side: 'buy' }])).toEqual([
      { tradeDate: '2020-12-16', price: 0.86, side: 'buy' },
    ]);
  });

  it('场内两笔都是买入，未登录时用这份快照', () => {
    expect(A500_ETF_TRADES).toEqual([
      { tradeDate: '2026-09-29', price: 1.207, side: 'buy' },
      { tradeDate: '2026-10-15', price: 1.146, side: 'buy' },
    ]);
  });

  it('场外四笔都是买入，净值与发车记录一致', () => {
    expect(A500_LINK_TRADES).toEqual([
      { tradeDate: '2026-07-29', price: 1.1920, side: 'buy' },
      { tradeDate: '2026-09-28', price: 1.1380, side: 'buy' },
      { tradeDate: '2026-10-22', price: 1.0505, side: 'buy' },
      { tradeDate: '2026-11-16', price: 1.0241, side: 'buy' },
    ]);
  });
});
