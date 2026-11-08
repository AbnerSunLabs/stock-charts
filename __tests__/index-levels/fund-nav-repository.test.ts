import { toFundNavPoints } from '@/lib/supabase/fund-nav-repository';

describe('fund_nav_daily 映射', () => {
  it('保留合法单位净值，丢掉空值和坏日期', () => {
    expect(
      toFundNavPoints([
        { nav_date: '2017-12-14', unit_nav: '1.0944' },
        { nav_date: '2026-06-25T00:00:00', unit_nav: 1.3281 },
        { nav_date: '2026-06-26', unit_nav: 0 },
        { nav_date: '', unit_nav: 1.1 },
      ])
    ).toEqual([
      { tradeDate: '2017-12-14', close: 1.0944 },
      { tradeDate: '2026-06-25', close: 1.3281 },
    ]);
  });
});
