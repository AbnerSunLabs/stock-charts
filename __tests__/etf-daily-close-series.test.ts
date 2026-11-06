import { settledEtfClosePoints } from '@/lib/supabase/etf-daily-repository';

describe('settledEtfClosePoints', () => {
  it('留下收盘后写入的点位，丢掉盘中价和空收盘', () => {
    const points = settledEtfClosePoints([
      {
        trade_date: '2017-12-27',
        close: '1',
        updated_at: '2026-07-09T09:21:37.648Z',
      },
      {
        trade_date: '2026-11-05',
        close: '0.85',
        updated_at: '2026-11-05T06:00:00.000Z',
      },
      {
        trade_date: '2026-11-05',
        close: null,
        updated_at: '2026-11-05T09:00:00.000Z',
      },
    ]);

    expect(points).toEqual([{ tradeDate: '2017-12-27', close: 1 }]);
  });
});
