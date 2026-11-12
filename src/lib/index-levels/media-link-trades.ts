import type { EtfTradeMark } from '@/lib/index-levels/media-etf-trades';

/** 长赢发车记录。图上写明买入或卖出，价格是交易时净值。 */
const MEDIA_LINK_ROWS: Array<[string, number, 'buy' | 'sell']> = [
  ['2018-01-19', 0.9959, 'buy'],
  ['2018-05-15', 0.9344, 'buy'],
  ['2018-07-16', 0.8029, 'buy'],
  ['2018-08-20', 0.728, 'buy'],
  ['2019-04-26', 0.814, 'buy'],
  ['2020-03-09', 0.8646, 'sell'],
  ['2021-04-29', 0.8067, 'buy'],
  ['2021-08-30', 0.6802, 'buy'],
  ['2023-03-20', 0.7558, 'sell'],
  ['2023-04-03', 0.8913, 'sell'],
  ['2023-04-14', 0.9018, 'sell'],
  ['2023-05-31', 0.9208, 'sell'],
  ['2025-08-22', 0.9836, 'sell'],
  ['2026-01-15', 1.2422, 'sell'],
];

/** 004752 广发中证传媒 ETF 联接 A 的发车买卖点。 */
export const MEDIA_LINK_TRADES: EtfTradeMark[] = MEDIA_LINK_ROWS.map(([tradeDate, price, side]) => ({
  tradeDate,
  price,
  side,
}));
