import type { SupabaseClient } from '@supabase/supabase-js';

import { fetchIndexCloseSeries } from '@/lib/supabase/index-daily-repository';

describe('fetchIndexCloseSeries', () => {
  it('保留收盘，只映射有限正数市盈率，零值和负值不进入图表', async () => {
    const rows = [0, -5, '0', '-2', null, 'bad', 20, '21.5'].map((pe_ttm, index) => ({
      trade_date: `2026-01-0${index + 1}`,
      close: 1000 + index,
      pe_ttm,
      updated_at: '2026-01-09T08:00:00Z',
    }));
    const query = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      not: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      range: jest.fn().mockResolvedValue({ data: rows, error: null }),
    };
    const client = { from: () => query } as unknown as SupabaseClient;

    const points = await fetchIndexCloseSeries(client, '399971.SZ');

    expect(points).toEqual([
      { tradeDate: '2026-01-01', close: 1000 },
      { tradeDate: '2026-01-02', close: 1001 },
      { tradeDate: '2026-01-03', close: 1002 },
      { tradeDate: '2026-01-04', close: 1003 },
      { tradeDate: '2026-01-05', close: 1004 },
      { tradeDate: '2026-01-06', close: 1005 },
      { tradeDate: '2026-01-07', close: 1006, peTtm: 20 },
      { tradeDate: '2026-01-08', close: 1007, peTtm: 21.5 },
    ]);
  });
});
