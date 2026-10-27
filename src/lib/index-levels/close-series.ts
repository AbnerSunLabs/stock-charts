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

export function formatCloseTick(value: number, max: number): string {
  if (max >= 1000) return `${Math.round(value / 1000)}K`;
  return String(Math.round(value));
}
