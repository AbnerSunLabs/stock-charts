/** 轮次 Tag：0 为灰底，越高越接近主色蓝，深底改白字 */
export interface GridRoundsTagStyle {
  background: string;
  borderColor: string;
  color: string;
}

const PRIMARY_RGB = '0, 82, 255';
const MAX_HEAT_LEVEL = 6;

/**
 * 轮次热力 Tag 样式；展示数字用原始 rounds，着色按 0–6 封顶。
 */
export function gridRoundsTagStyle(rounds: number): GridRoundsTagStyle {
  const n = Number.isFinite(rounds) ? Math.max(0, Math.floor(rounds)) : 0;
  const level = Math.min(n, MAX_HEAT_LEVEL);
  if (level === 0) {
    return {
      background: '#fafafa',
      borderColor: '#d9d9d9',
      color: '#595959',
    };
  }
  const alpha = Math.min(Number((0.16 + level * 0.14).toFixed(2)), 0.92);
  const color = alpha >= 0.55 ? '#ffffff' : '#0a0b0d';
  const bg = `rgba(${PRIMARY_RGB}, ${alpha})`;
  return { background: bg, borderColor: bg, color };
}

/**
 * 聚合组折叠时：子档轮次之和。
 */
export function sumChildRounds(
  childLegIds: string[],
  getRounds: (levelKey: string) => number
): number {
  return childLegIds.reduce((sum, id) => sum + getRounds(id), 0);
}
