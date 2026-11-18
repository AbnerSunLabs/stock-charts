import { INDEX_WATCHES } from '@/lib/index-levels/catalog';
import { isJournalLinkedEtf, journalTradesToMarks, resolveEtfChartMarks } from '@/lib/index-levels/etf-journal-marks';
import { MEDICAL_LINK_TRADES } from '@/lib/index-levels/medical-link-trades';

describe('中证医疗关联基金', () => {
  it('跟踪 399989，场内 512170，场外 162412', () => {
    const watch = INDEX_WATCHES.find(item => item.code === '399989.SZ');
    expect(watch?.name).toBe('中证医疗');
    expect(watch?.chartEtf).toEqual({ code: '512170', name: '华宝中证医疗ETF' });
    expect(watch?.chartFund).toEqual({
      code: '162412',
      name: '华宝医疗ETF联接A',
      href: 'https://qieman.com/longwin/funds/162412?prodCode=LONG_WIN',
    });
  });

  it('512170 已登录只用标的对得上的流水，未登录不画快照', () => {
    const marks = journalTradesToMarks(
      [
        { id: 'medical', symbol: '512170' },
        { id: 'a500', symbol: '563360' },
      ],
      [
        { strategyId: 'a500', tradeDate: '2026-10-15', price: 1.146, side: 'buy', createdAt: '1' },
        { strategyId: 'medical', tradeDate: '2026-11-03', price: 0.312, side: 'sell', createdAt: '2' },
        { strategyId: 'medical', tradeDate: '2026-09-01', price: 0.286, side: 'buy', createdAt: '1' },
      ],
      '512170'
    );
    expect(marks).toEqual([
      { tradeDate: '2026-09-01', price: 0.286, side: 'buy' },
      { tradeDate: '2026-11-03', price: 0.312, side: 'sell' },
    ]);
    expect(isJournalLinkedEtf('512170')).toBe(true);
    expect(resolveEtfChartMarks('512170', { status: 'live', marks }, [])).toEqual(marks);
    expect(resolveEtfChartMarks('512170', { status: 'pending' }, [])).toEqual([]);
    expect(resolveEtfChartMarks('512170', { status: 'signed-out' }, [])).toEqual([]);
  });

  it('删掉一笔流水后，折线买卖点只剩剩下的那笔', () => {
    const before = journalTradesToMarks(
      [{ id: 'medical', symbol: '512170.SH' }],
      [
        { strategyId: 'medical', tradeDate: '2026-09-01', price: 0.286, side: 'buy', createdAt: '1' },
        { strategyId: 'medical', tradeDate: '2026-11-03', price: 0.312, side: 'sell', createdAt: '2' },
      ],
      '512170'
    );
    const after = journalTradesToMarks(
      [{ id: 'medical', symbol: '512170.SH' }],
      [{ strategyId: 'medical', tradeDate: '2026-09-01', price: 0.286, side: 'buy', createdAt: '1' }],
      '512170'
    );
    expect(before).toHaveLength(2);
    expect(resolveEtfChartMarks('512170', { status: 'live', marks: after }, [])).toEqual(after);
  });

  it('162412 只画已确认的四笔买入，交易失败不在里面', () => {
    expect(MEDICAL_LINK_TRADES).toEqual([
      { tradeDate: '2023-05-10', price: 0.7791, side: 'buy' },
      { tradeDate: '2023-07-19', price: 0.7110, side: 'buy' },
      { tradeDate: '2023-08-22', price: 0.6861, side: 'buy' },
      { tradeDate: '2025-05-22', price: 0.5657, side: 'buy' },
    ]);
    expect(MEDICAL_LINK_TRADES.some(mark => mark.side === 'sell')).toBe(false);
  });
});
