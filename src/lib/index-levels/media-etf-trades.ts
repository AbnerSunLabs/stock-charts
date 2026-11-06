import type { IndexClosePoint } from '@/lib/index-levels/close-series';

export interface EtfTradeMark {
  tradeDate: string;
  side: 'buy' | 'sell';
  price: number;
}

/** 收益列有值记为卖出，否则记为买入。价格用实际交易价格。 */
const MEDIA_ETF_ROWS: Array<[string, number, 'buy' | 'sell']> = [
  ['2020-12-16', 0.86, 'buy'],
  ['2021-03-15', 0.8, 'buy'],
  ['2021-07-26', 0.74, 'buy'],
  ['2021-07-28', 0.679, 'buy'],
  ['2021-09-08', 0.74, 'sell'],
  ['2021-10-27', 0.679, 'buy'],
  ['2021-11-05', 0.74, 'sell'],
  ['2021-11-16', 0.8, 'sell'],
  ['2021-11-29', 0.74, 'buy'],
  ['2021-12-13', 0.8, 'sell'],
  ['2021-12-31', 0.86, 'sell'],
  ['2022-01-24', 0.8, 'buy'],
  ['2022-01-27', 0.74, 'buy'],
  ['2022-03-08', 0.679, 'buy'],
  ['2022-04-25', 0.576, 'buy'],
  ['2023-02-07', 0.679, 'sell'],
  ['2023-03-20', 0.749, 'sell'],
  ['2023-03-24', 0.8, 'sell'],
  ['2023-04-03', 0.86, 'sell'],
  ['2023-04-12', 0.92, 'sell'],
  ['2023-09-08', 0.775, 'buy'],
  ['2023-10-20', 0.698, 'buy'],
  ['2023-11-07', 0.775, 'sell'],
  ['2023-12-25', 0.698, 'buy'],
  ['2024-02-05', 0.585, 'buy'],
  ['2024-02-20', 0.698, 'sell'],
  ['2024-03-19', 0.775, 'sell'],
  ['2024-04-15', 0.698, 'buy'],
  ['2024-07-08', 0.586, 'buy'],
  ['2024-09-30', 0.698, 'sell'],
  ['2024-10-08', 0.812, 'sell'],
  ['2024-10-11', 0.698, 'buy'],
  ['2024-10-22', 0.775, 'sell'],
  ['2024-12-05', 0.853, 'sell'],
  ['2024-12-31', 0.775, 'buy'],
  ['2025-02-10', 0.853, 'sell'],
  ['2025-04-07', 0.775, 'buy'],
  ['2025-04-09', 0.698, 'buy'],
  ['2025-04-10', 0.775, 'sell'],
  ['2025-06-30', 0.853, 'sell'],
  ['2025-09-16', 1.055, 'sell'],
  ['2026-01-13', 1.35, 'sell'],
  ['2026-07-14', 0.775, 'buy'],
  ['2026-07-31', 0.853, 'sell'],
  ['2026-10-08', 0.775, 'buy'],
  ['2026-11-05', 0.852, 'sell'],
];

/** 512980 成交流水。来自已核对的历史成交表。 */
export const MEDIA_ETF_TRADES: EtfTradeMark[] = MEDIA_ETF_ROWS.map(([tradeDate, price, side]) => ({
  tradeDate,
  price,
  side,
}));

const MATCH_DAYS = 4;

export interface CloseWithTrade extends IndexClosePoint {
  tradeSide?: 'buy' | 'sell';
  tradePrice?: number;
}

/** 成交日对到收盘日。休市日落到前后 4 天内最近的空位，不盖住已有成交。 */
export function withTradeMarks<T extends IndexClosePoint>(points: T[], marks: EtfTradeMark[]): Array<T & CloseWithTrade> {
  const dates = points.map(point => point.tradeDate);
  const placed = new Map<string, EtfTradeMark>();
  const pending: EtfTradeMark[] = [];
  for (const mark of marks) {
    if (dates.includes(mark.tradeDate)) placed.set(mark.tradeDate, mark);
    else pending.push(mark);
  }
  for (const mark of pending) {
    const date = nearestFreeDate(dates, mark.tradeDate, placed);
    if (date) placed.set(date, mark);
  }
  return points.map(point => {
    const mark = placed.get(point.tradeDate);
    if (!mark) return point;
    return { ...point, tradeSide: mark.side, tradePrice: mark.price };
  });
}

function nearestFreeDate(dates: string[], target: string, taken: Map<string, EtfTradeMark>): string | null {
  const targetMs = Date.parse(`${target}T00:00:00Z`);
  let best: string | null = null;
  let bestGap = MATCH_DAYS + 1;
  for (const date of dates) {
    if (taken.has(date)) continue;
    const gap = Math.abs(Date.parse(`${date}T00:00:00Z`) - targetMs) / 86_400_000;
    if (gap < bestGap) {
      best = date;
      bestGap = gap;
    }
  }
  return bestGap <= MATCH_DAYS ? best : null;
}
