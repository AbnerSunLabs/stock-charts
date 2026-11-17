import type { EtfTradeMark } from '@/lib/index-levels/media-etf-trades';

/** 563360 网格流水里的成交。价格是实际成交价。 */
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
