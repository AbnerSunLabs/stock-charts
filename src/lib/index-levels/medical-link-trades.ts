import type { EtfTradeMark } from '@/lib/index-levels/media-etf-trades';

/**
 * 长赢计划里已确认的买入。同一天的「交易失败」没有确认净值，不画。
 * 价格是确认净值。
 */
const MEDICAL_LINK_ROWS: Array<[string, number, 'buy' | 'sell']> = [
  ['2023-05-10', 0.7791, 'buy'],
  ['2023-07-19', 0.7110, 'buy'],
  ['2023-08-22', 0.6861, 'buy'],
  ['2025-05-22', 0.5657, 'buy'],
];

/** 162412 华宝医疗ETF联接A 的已确认买卖点。 */
export const MEDICAL_LINK_TRADES: EtfTradeMark[] = MEDICAL_LINK_ROWS.map(([tradeDate, price, side]) => ({
  tradeDate,
  price,
  side,
}));
