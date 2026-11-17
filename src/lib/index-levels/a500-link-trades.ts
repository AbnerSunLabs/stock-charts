import type { EtfTradeMark } from '@/lib/index-levels/media-etf-trades';

/** 长赢发车记录。图上写明买入，价格是交易时净值。 */
const A500_LINK_ROWS: Array<[string, number, 'buy' | 'sell']> = [
  ['2026-07-29', 1.1920, 'buy'],
  ['2026-09-28', 1.1380, 'buy'],
  ['2026-10-22', 1.0505, 'buy'],
  ['2026-11-16', 1.0241, 'buy'],
];

/** 022424 广发中证A500ETF联接A 的发车买卖点。 */
export const A500_LINK_TRADES: EtfTradeMark[] = A500_LINK_ROWS.map(([tradeDate, price, side]) => ({
  tradeDate,
  price,
  side,
}));
