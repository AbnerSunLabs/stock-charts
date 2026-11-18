/** @jest-environment node */

import {
  attachIndexPe,
  mergePe,
  parseCsindexPe,
  peHoverStats,
} from "@/lib/index-levels/pe-series";

const HISTORY = [
  { tradeDate: "2016-01-05", peTtm: 10 },
  { tradeDate: "2020-01-02", peTtm: 20 },
  { tradeDate: "2021-01-05", peTtm: 30 },
  { tradeDate: "2026-01-05", peTtm: 15 },
];

describe("peHoverStats", () => {
  it("按悬停日之前的日期切五年和十年，不按行数", () => {
    const stats = peHoverStats(HISTORY, "2026-01-05");
    expect(stats).toEqual({
      peTtm: 15,
      historyRank: 50,
      fiveYearRank: 50,
      tenYearRank: 50,
      fiveYearMean: 22.5,
      tenYearMean: 18.75,
      fiveYearGap: (15 / 22.5 - 1) * 100,
      tenYearGap: (15 / 18.75 - 1) * 100,
    });
  });

  it("没有这一天的市盈率时不编一组数", () => {
    expect(peHoverStats(HISTORY, "2026-01-06")).toBeNull();
  });

  it('分位、均值和偏离都不计入非正数或非有限市盈率', () => {
    const stats = peHoverStats([
      { tradeDate: '2026-01-01', peTtm: 0 },
      { tradeDate: '2026-01-02', peTtm: -5 },
      { tradeDate: '2026-01-03', peTtm: Number.NaN },
      { tradeDate: '2026-01-04', peTtm: 30 },
      { tradeDate: '2026-01-05', peTtm: 20 },
    ], '2026-01-05');

    expect(stats?.historyRank).toBe(50);
    expect(stats?.fiveYearRank).toBe(50);
    expect(stats?.tenYearRank).toBe(50);
    expect(stats?.fiveYearMean).toBe(25);
    expect(stats?.tenYearMean).toBe(25);
    expect(stats?.fiveYearGap).toBeCloseTo(-20);
    expect(stats?.tenYearGap).toBeCloseTo(-20);
  });

  it.each([0, -5, Number.NaN, Number.POSITIVE_INFINITY])(
    '悬停日市盈率为 %s 时不展示估值统计',
    peTtm => {
      expect(peHoverStats([{ tradeDate: '2026-01-05', peTtm }], '2026-01-05')).toBeNull();
    },
  );
});

describe("mergePe", () => {
  it("只填空缺，库里已有的市盈率不动", () => {
    const merged = mergePe(
      [
        { tradeDate: "2026-01-05", close: 1000, peTtm: 16 },
        { tradeDate: "2026-01-06", close: 1010 },
      ],
      [
        { tradeDate: "2026-01-05", peTtm: 15 },
        { tradeDate: "2026-01-06", peTtm: 18 },
      ],
    );
    expect(merged.map((point) => point.peTtm)).toEqual([16, 18]);
  });

  it('无效的库内市盈率允许由官网正值补齐', () => {
    const merged = mergePe([
      { tradeDate: '2026-01-05', close: 1000, peTtm: 0 },
      { tradeDate: '2026-01-06', close: 1010, peTtm: -5 },
    ], [
      { tradeDate: '2026-01-05', peTtm: 15 },
      { tradeDate: '2026-01-06', peTtm: 18 },
    ]);

    expect(merged.map(point => point.peTtm)).toEqual([15, 18]);
  });
});

describe('attachIndexPe', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('部分日期已有市盈率时仍补全历史，并保留库内正值', async () => {
    global.fetch = jest.fn(async () => Response.json({ points: [
      { tradeDate: '2026-01-05', peTtm: 10 },
      { tradeDate: '2026-01-06', peTtm: 40 },
      { tradeDate: '2026-01-07', peTtm: 19 },
    ] }));

    const points = await attachIndexPe('399971.SZ', [
      { tradeDate: '2026-01-05', close: 1000 },
      { tradeDate: '2026-01-06', close: 1010 },
      { tradeDate: '2026-01-07', close: 1020, peTtm: 20 },
    ]);
    expect(points.map(point => point.peTtm)).toEqual([10, 40, 20]);
    const stats = peHoverStats(points.map(point => ({
      tradeDate: point.tradeDate,
      peTtm: point.peTtm ?? Number.NaN,
    })), '2026-01-07');
    expect(stats?.historyRank).toBeCloseTo(66.66666667);
    expect(stats?.fiveYearMean).toBeCloseTo(23.33333333);
    expect(stats?.fiveYearGap).toBeCloseTo(-14.28571429);
  });

  it('全部日期已有有效市盈率时不请求官网', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock;
    const points = [{ tradeDate: '2026-01-05', close: 1000, peTtm: 20 }];

    expect(await attachIndexPe('399971.SZ', points)).toBe(points);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('官网读取失败仍保留已有收盘和市盈率', async () => {
    global.fetch = jest.fn(async () => new Response(null, { status: 502 }));
    const points = [
      { tradeDate: '2026-01-05', close: 1000 },
      { tradeDate: '2026-01-06', close: 1010, peTtm: 20 },
    ];

    expect(await attachIndexPe('399971.SZ', points)).toBe(points);
  });
});

describe("parseCsindexPe", () => {
  it("把 peg 收成交易日和滚动市盈率，0 是官网占位不算估值", () => {
    expect(
      parseCsindexPe({
        data: [
          { tradeDate: "20141105", peg: 0 },
          { tradeDate: "20180102", peg: "31.02" },
          { tradeDate: "bad", peg: 1 },
        ],
      }),
    ).toEqual([{ tradeDate: "2018-01-02", peTtm: 31.02 }]);
  });
});
