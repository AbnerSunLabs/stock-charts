import type { EtfTradeMark } from '@/lib/index-levels/media-etf-trades';

/** 收益列有值记为卖出，否则记为买入。价格用实际交易价格。 */
const SECURITIES_ETF_ROWS: Array<[string, number, 'buy' | 'sell']> = [
  ['2021-03-15', 1.03, 'buy'],
  ['2021-05-25', 1.133, 'sell'],
  ['2021-07-30', 1.03, 'buy'],
  ['2021-08-18', 1.133, 'sell'],
  ['2022-02-24', 1.03, 'buy'],
  ['2022-03-09', 0.927, 'buy'],
  ['2022-06-15', 1.03, 'sell'],
  ['2022-07-11', 0.927, 'buy'],
  ['2023-07-31', 1.03, 'sell'],
  ['2023-10-09', 0.927, 'buy'],
  ['2024-01-22', 0.824, 'buy'],
  ['2024-02-28', 0.927, 'sell'],
  ['2024-04-10', 0.824, 'buy'],
  ['2024-09-26', 0.927, 'sell'],
  ['2024-09-30', 1.1, 'sell'],
  ['2024-10-08', 1.218, 'sell'],
  ['2025-04-07', 1.03, 'buy'],
  ['2025-06-25', 1.133, 'sell'],
  ['2026-03-23', 1.031, 'buy'],
  ['2026-06-22', 1.132, 'sell'],
];

/** 512880 成交流水。来自已核对的历史成交表。 */
export const SECURITIES_ETF_TRADES: EtfTradeMark[] = SECURITIES_ETF_ROWS.map(([tradeDate, price, side]) => ({
  tradeDate,
  price,
  side,
}));
