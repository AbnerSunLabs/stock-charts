import { filterCloseSpan } from '@/lib/index-levels/close-series';
import { INDEX_WATCHES } from '@/lib/index-levels/catalog';
import { changePct, formatMarkLabel, gapPercentPhrase, gapPhrase, gapText, nearestLevel, scalePercent } from '@/lib/index-levels/position';
import { pickLatestClose } from '@/lib/supabase/index-daily-repository';

describe('index level position', () => {
  const csi500 = INDEX_WATCHES[0];

  it('现价更靠近哪条判断点位', () => {
    expect(nearestLevel(6800, csi500.levels)?.level.name).toBe('外太空');
    expect(gapText(6800, csi500.levels)).toBe('低于外太空 1,700 点，20.0%');
  });

  it('刻度把现价放在判断点位之间', () => {
    expect(gapPhrase(6800.66, csi500.levels)).toBe('低于外太空 1,699 点');
    expect(formatMarkLabel('11200–11300')).toBe('11,200–11,300');
    const points = [8500, 4800, 6800.66];
    expect(scalePercent(8500, points)).toBeLessThan(scalePercent(6800.66, points));
    expect(scalePercent(6800.66, points)).toBeLessThan(scalePercent(4800, points));
  });

  it('仪表盘用相对点位的百分比', () => {
    expect(gapPercentPhrase(6712.73, csi500.levels)).toBe('低于外太空 21.0%');
  });

  it('近五年从最后一根收盘往前切', () => {
    const points = [
      { tradeDate: '2010-01-04', close: 1000 },
      { tradeDate: '2021-10-26', close: 6000 },
      { tradeDate: '2026-10-26', close: 6712.73 },
    ];
    expect(filterCloseSpan(points, '5').map(point => point.tradeDate)).toEqual(['2021-10-26', '2026-10-26']);
    expect(filterCloseSpan(points, 'all')).toHaveLength(3);
  });

  it('用前一收盘算涨跌幅', () => {
    expect(changePct(6800, 6700)).toBeCloseTo(1.4925, 3);
    expect(changePct(6800, null)).toBeNull();
  });
});

describe('pickLatestClose', () => {
  it('跳过 15:00 前写入的当日点位，并带上前一收盘', () => {
    const picked = pickLatestClose('000905.SH', [
      {
        index_code: '000905.SH',
        trade_date: '2026-10-20',
        close: '6900',
        updated_at: '2026-10-20T06:00:00.000Z',
      },
      {
        index_code: '000905.SH',
        trade_date: '2026-10-19',
        close: '6800.66',
        updated_at: '2026-10-19T11:30:00.000Z',
      },
      {
        index_code: '000905.SH',
        trade_date: '2026-10-16',
        close: '6700',
        updated_at: '2026-10-16T11:30:00.000Z',
      },
    ]);
    expect(picked).toEqual({
      indexCode: '000905.SH',
      tradeDate: '2026-10-19',
      close: 6800.66,
      previousClose: 6700,
    });
  });
});
