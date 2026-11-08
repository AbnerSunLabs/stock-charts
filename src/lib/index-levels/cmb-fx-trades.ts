import type { EtfTradeMark } from '@/lib/index-levels/media-etf-trades';

/** 招行购汇成交。源汇率按 100 美元，这里折成 1 美元，标在汇卖折线上。 */
const CMB_USD_BUY_ROWS: Array<[string, number]> = [
  ['2026-01-21', 698.32],
  ['2026-02-25', 689.04],
  ['2026-04-08', 684.6],
  ['2026-05-12', 681.11],
  ['2026-09-23', 672.36],
];

/** 100 外币汇率折成 1 美元。 */
function perDollar(quote: number): number {
  return Math.round((quote / 100) * 100000) / 100000;
}

/** 已核对的招行美元购汇。成交价是当天汇卖。 */
export const CMB_USD_BUY_MARKS: EtfTradeMark[] = CMB_USD_BUY_ROWS.map(([tradeDate, quote]) => ({
  tradeDate,
  side: 'buy',
  price: perDollar(quote),
}));
