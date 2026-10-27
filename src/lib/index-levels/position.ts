import type { IndexLevelMark } from '@/lib/index-levels/catalog';

export interface NearestLevel {
  level: IndexLevelMark;
  gap: number;
}

export function formatPoint(value: number): string {
  return value.toLocaleString('zh-CN', {
    maximumFractionDigits: value >= 10000 ? 0 : 2,
  });
}

export function nearestLevel(
  last: number,
  levels: IndexLevelMark[]
): NearestLevel | null {
  return levels.reduce<NearestLevel | null>((best, level) => {
    const gap = Math.abs(last - level.point);
    if (!best || gap < best.gap) return { level, gap };
    return best;
  }, null);
}

/** 收盘保留两位小数，判断点位标签单独格式化。 */
export function formatClose(value: number): string {
  return value.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** 区间标签按下沿定位，展示时给数字加上千分位。 */
export function formatMarkLabel(label: string): string {
  return label.replace(/\d+/g, digits => Number(digits).toLocaleString('zh-CN'));
}

/** 现价在刻度上的百分比。上下各留出区间的 22%，避免贴边。 */
export function scalePercent(value: number, points: number[]): number {
  const max = Math.max(...points);
  const min = Math.min(...points);
  const span = Math.max(max - min, 1);
  const top = max + span * 0.22;
  const bottom = min - span * 0.22;
  return ((top - value) / (top - bottom)) * 100;
}

/** 现价相对最近判断点位的百分比。贴着时不带百分数。 */
export function gapPercentPhrase(last: number, levels: IndexLevelMark[]): string {
  const found = nearestLevel(last, levels);
  if (!found) return '还没有判断点位';
  const delta = last - found.level.point;
  if (delta === 0) return `贴着${found.level.name}`;
  const side = delta > 0 ? '高出' : '低于';
  const pct = (Math.abs(delta) / found.level.point) * 100;
  return `${side}${found.level.name} ${pct.toFixed(1)}%`;
}

/** 现价相对最近判断点位的距离，不含百分比。 */
export function gapPhrase(last: number, levels: IndexLevelMark[]): string {
  const found = nearestLevel(last, levels);
  if (!found) return '还没有判断点位';
  const delta = last - found.level.point;
  const side = delta > 0 ? '高出' : delta < 0 ? '低于' : '贴着';
  const points = Math.abs(delta).toLocaleString('zh-CN', { maximumFractionDigits: 0 });
  return `${side}${found.level.name} ${points} 点`;
}

/** 现价相对最近判断点位的距离，并带上相对该点位的百分比。 */
export function gapText(last: number, levels: IndexLevelMark[]): string {
  const found = nearestLevel(last, levels);
  if (!found) return '还没有判断点位';
  const delta = last - found.level.point;
  const side = delta > 0 ? '高出' : delta < 0 ? '低于' : '贴着';
  const points = Math.abs(delta);
  const pct = (points / found.level.point) * 100;
  return `${side}${found.level.name} ${formatPoint(points)} 点，${pct.toFixed(1)}%`;
}

export function changePct(close: number, previous: number | null): number | null {
  if (previous == null || previous === 0) return null;
  return ((close - previous) / previous) * 100;
}
