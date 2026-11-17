import type { EtfTradeMark } from '@/lib/index-levels/media-etf-trades';

/** 未登录时的 563360 快照。已登录后点位页改读网格流水，不再用这份。 */
const A500_ETF_ROWS: Array<[string, number, 'buy' | 'sell']> = [
  ['2026-09-29', 1.207, 'buy'],
  ['2026-10-15', 1.146, 'buy'],
];

/** 563360 华泰柏瑞中证A500ETF 的买卖点。 */
export const A500_ETF_TRADES: EtfTradeMark[] = A500_ETF_ROWS.map(([tradeDate, price, side]) => ({
  tradeDate,
  price,
  side,
}));
