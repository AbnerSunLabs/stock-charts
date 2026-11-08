import type { EtfTradeMark } from '@/lib/index-levels/media-etf-trades';

/** 长赢发车记录，来自 https://qieman.com/longwin/funds/502010?prodCode=LONG_WIN 。图上写明买入或卖出，价格是交易时净值。 */
const SECURITIES_LINK_ROWS: Array<[string, number, 'buy' | 'sell']> = [
  ['2017-12-14', 1.0944, 'buy'],
  ['2018-04-02', 1.0026, 'buy'],
  ['2018-06-19', 0.8457, 'buy'],
  ['2018-10-15', 0.6991, 'buy'],
  ['2023-02-01', 1.1290, 'sell'],
  ['2023-08-08', 1.2160, 'sell'],
  ['2024-11-11', 1.5056, 'sell'],
  ['2026-06-25', 1.3281, 'sell'],
];

/** 502010 易方达中证全指证券公司指数(LOF)A 的发车买卖点。 */
export const SECURITIES_LINK_TRADES: EtfTradeMark[] = SECURITIES_LINK_ROWS.map(([tradeDate, price, side]) => ({
  tradeDate,
  price,
  side,
}));
