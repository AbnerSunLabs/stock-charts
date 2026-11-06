import { INDEX_WATCHES, resolveWatchedIndex } from '@/lib/index-levels/catalog';
import { changePercent, closePlotDomain, filterCloseSpan, formatCloseTick, withRunningHigh } from '@/lib/index-levels/close-series';
import { changePct, formatMarkLabel, gapPercentPhrase, gapPhrase, gapText, levelMentionDate, nearestLevel, scalePercent } from '@/lib/index-levels/position';
import { pickLatestClose } from '@/lib/supabase/index-daily-repository';

describe('levelMentionDate', () => {
  it('用点位标签对齐发言日期，同一点位取最早一次', () => {
    const media = INDEX_WATCHES.find(item => item.code === '399971.SZ');
    const pressure = media?.levels.find(level => level.name === '压力');
    expect(pressure && media ? levelMentionDate(pressure, media.quotes) : null).toBe('2023-03-21');
    const priorLow = media?.levels.find(level => level.name === '前低');
    expect(priorLow && media ? levelMentionDate(priorLow, media.quotes) : null).toBe('2022-04-18');
    const eighty = media?.levels.find(level => level.name === '80位置');
    expect(eighty && media ? levelMentionDate(eighty, media.quotes) : null).toBe('2023-10-18');
    const clear = media?.levels.find(level => level.name === '梭哈');
    expect(clear && media ? levelMentionDate(clear, media.quotes) : null).toBe('2018-06-04');

    const csi500 = INDEX_WATCHES.find(item => item.code === '000905.SH');
    const space = csi500?.levels.find(level => level.name === '外太空');
    expect(space && csi500 ? levelMentionDate(space, csi500.quotes) : null).toBe('2026-01-12');
  });

  it('8500 不会配到含 18500 的发言', () => {
    expect(
      levelMentionDate(
        { name: '外太空', point: 8500, label: '8500' },
        [
          {
            postId: 1,
            date: '2022-04-05',
            level: '价值区 18500–22000',
            text: '',
          },
        ]
      )
    ).toBeNull();
  });
});

describe('resolveWatchedIndex', () => {
  it('名单里的代码原样返回，其余用第一只', () => {
    expect(resolveWatchedIndex('399971.SZ')).toBe('399971.SZ');
    expect(resolveWatchedIndex(null)).toBe(INDEX_WATCHES[0]?.code);
    expect(resolveWatchedIndex('not-an-index')).toBe(INDEX_WATCHES[0]?.code);
  });
});

describe('index level position', () => {
  const csi500 = INDEX_WATCHES[0];

  it('现价更靠近哪条判断点位', () => {
    expect(nearestLevel(6800, csi500.levels)?.level.name).toBe('外太空');
    expect(gapText(6800, csi500.levels)).toBe('低于外太空 1,700 点，20.0%');
  });

  it('刻度把现价放在判断点位之间', () => {
    expect(gapPhrase(6800.66, csi500.levels)).toBe('低于外太空 1,699 点');
    expect(formatMarkLabel('11200–11300')).toBe('11,200–11,300');
    expect(formatMarkLabel('7.08')).toBe('7.08');
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
    const marked = withRunningHigh(points);
    expect(marked.map(point => point.maxClose)).toEqual([1000, 6000, 6712.73]);
    expect(changePercent(1000, 6712.73)).toBeCloseTo(571.273, 2);
    expect(changePercent(6712.73, 4800)).toBeLessThan(0);
  });

  it('汇率纵轴贴着收盘，指数仍从 0 起', () => {
    const fx = [
      { tradeDate: '2026-10-23', close: 6.669 },
      { tradeDate: '2026-10-26', close: 6.6676 },
    ];
    const [min, max] = closePlotDomain(fx);
    expect(min).toBeGreaterThan(6);
    expect(max).toBeGreaterThan(6.6676);
    expect(closePlotDomain([{ tradeDate: '2026-10-26', close: 6712.73 }])[0]).toBe(0);
    expect(formatCloseTick(6.67, 7.4)).toBe('6.67');
    expect(formatCloseTick(0, 5000)).toBe('0');
    expect(formatCloseTick(2000, 5000)).toBe('2K');
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
