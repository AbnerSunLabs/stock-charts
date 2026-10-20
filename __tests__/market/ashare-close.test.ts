import { isSettledAshareClose } from '@/lib/market/ashare-close';

describe('isSettledAshareClose', () => {
  it('盘中写入的当日 K 不是收盘', () => {
    expect(
      isSettledAshareClose('2026-10-15', '2026-10-15T06:25:39.347Z')
    ).toBe(false);
  });

  it('当日 15:00 之后写入才算收盘', () => {
    expect(
      isSettledAshareClose('2026-10-15', '2026-10-15T07:00:00.000Z')
    ).toBe(true);
    expect(
      isSettledAshareClose('2026-10-15', '2026-10-15T10:10:00.000Z')
    ).toBe(true);
  });

  it('次日早上回补的上一交易日收盘有效', () => {
    expect(
      isSettledAshareClose('2026-10-14', '2026-10-15T01:40:00.000Z')
    ).toBe(true);
  });

  it('同一天收盘前写入的历史 K 无效', () => {
    expect(
      isSettledAshareClose('2026-10-14', '2026-10-14T03:53:00.000Z')
    ).toBe(false);
  });
});
