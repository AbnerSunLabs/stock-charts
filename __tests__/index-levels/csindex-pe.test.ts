/** @jest-environment node */

const originalFetch = global.fetch;

beforeEach(() => {
  jest.resetModules();
  jest.useFakeTimers({ now: new Date('2026-11-18T00:00:00Z') });
});

afterEach(() => {
  global.fetch = originalFetch;
  jest.useRealTimers();
});

describe('fetchCsindexPe', () => {
  it.each(['http', 'network', 'json', 'payload'])(
    '年度发生 %s 错误时不返回残缺历史，恢复后可以重新读取',
    async failure => {
      const { fetchCsindexPe } = await import('@/lib/index-levels/csindex-pe');
      let broken = true;
      global.fetch = jest.fn(async (input: Parameters<typeof fetch>[0]) => {
        const url = new URL(String(input));
        const year = url.searchParams.get('startDate')?.slice(0, 4);
        if (year === '2020' && broken) {
          if (failure === 'http') return new Response(null, { status: 503 });
          if (failure === 'network') throw new Error('network unavailable');
          if (failure === 'json') return new Response('invalid json');
          return Response.json({ message: 'temporarily unavailable' });
        }
        const data = year === '2020'
          ? [{ tradeDate: '20200102', peg: 30 }]
          : year === '2026' ? [{ tradeDate: '20260105', peg: 15 }] : [];
        return Response.json({ data });
      });

      await expect(fetchCsindexPe('399971.SZ')).rejects.toThrow();
      broken = false;
      await expect(fetchCsindexPe('399971.SZ')).resolves.toEqual([
        { tradeDate: '2020-01-02', peTtm: 30 },
        { tradeDate: '2026-01-05', peTtm: 15 },
      ]);
    },
  );

  it('完整读取允许空年份，缓存六小时后才更新', async () => {
    const { fetchCsindexPe } = await import('@/lib/index-levels/csindex-pe');
    let currentPe = 15;
    global.fetch = jest.fn(async (input: Parameters<typeof fetch>[0]) => {
      const year = new URL(String(input)).searchParams.get('startDate')?.slice(0, 4);
      return Response.json({ data: year === '2026' ? [{ tradeDate: '20260105', peg: currentPe }] : [] });
    });

    await expect(fetchCsindexPe('399971.SZ')).resolves.toEqual([
      { tradeDate: '2026-01-05', peTtm: 15 },
    ]);
    currentPe = 20;
    await expect(fetchCsindexPe('399971.SZ')).resolves.toEqual([
      { tradeDate: '2026-01-05', peTtm: 15 },
    ]);
    jest.setSystemTime(new Date('2026-11-18T06:00:01Z'));
    await expect(fetchCsindexPe('399971.SZ')).resolves.toEqual([
      { tradeDate: '2026-01-05', peTtm: 20 },
    ]);
  });
});
