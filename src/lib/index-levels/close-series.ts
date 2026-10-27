/** 点位跟踪折线用的已收盘序列。 */

export interface IndexClosePoint {
  tradeDate: string;
  close: number;
}

export type CloseSpan = 'all' | '10' | '5';

/** 近 N 年从最后一根收盘往前切，按日期字符串比较，避开时区。 */
export function filterCloseSpan(points: IndexClosePoint[], span: CloseSpan): IndexClosePoint[] {
  if (span === 'all' || points.length === 0) return points;
  const end = points[points.length - 1]?.tradeDate ?? '';
  const [year, month, day] = end.split('-');
  const cut = `${Number(year) - Number(span)}-${month}-${day}`;
  return points.filter(point => point.tradeDate >= cut);
}

/** 收盘轴上限取整，小指数用更细的步长。 */
export function closeAxisMax(max: number): number {
  const step = max >= 2000 ? 2000 : max >= 200 ? 200 : 20;
  return Math.max(step, Math.ceil(max / step) * step);
}

/** 指数从 0 起画。汇率的波动挤在个位数里，纵轴贴着这组收盘。 */
export function closePlotDomain(points: IndexClosePoint[]): [number, number] {
  const max = points.reduce((peak, row) => Math.max(peak, row.close), 0);
  if (points.length === 0 || max >= 100) return [0, Math.max(max, 1)];
  const min = points.reduce((floor, row) => Math.min(floor, row.close), max);
  const pad = Math.max((max - min) * 0.08, max * 0.01);
  return [Math.max(0, min - pad), max + pad];
}

export function formatCloseTick(value: number, max: number): string {
  if (max >= 1000) return `${Math.round(value / 1000)}K`;
  if (max < 20) return value.toFixed(2);
  return String(Math.round(value));
}

/** 到当日为止的最高收盘。etf.run 的距前高用的就是这个滚动高点。 */
export function withRunningHigh(points: IndexClosePoint[]): Array<IndexClosePoint & { maxClose: number }> {
  let maxClose = 0;
  return points.map(point => {
    maxClose = Math.max(maxClose, point.close);
    return { ...point, maxClose };
  });
}

/** (现价 - 基准) / 基准，按百分比。基准为 0 时没有涨跌。 */
export function changePercent(base: number, value: number): number | null {
  if (!Number.isFinite(base) || base === 0) return null;
  return ((value - base) / base) * 100;
}
