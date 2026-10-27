/** 仪表盘几何：低点在左下，顺时针经过顶部到右下。 */

export const GAUGE = {
  cx: 250,
  cy: 210,
  r: 148,
  face: 178,
  start: 150,
  sweep: 240,
};

export function gaugeBounds(points: number[]): { top: number; bottom: number } {
  const max = Math.max(...points);
  const min = Math.min(...points);
  const span = Math.max(max - min, 1);
  return { top: max + span * 0.16, bottom: min - span * 0.16 };
}

export function gaugeDeg(value: number, bottom: number, top: number): number {
  return GAUGE.start + ((value - bottom) / (top - bottom)) * GAUGE.sweep;
}

export function polar(radius: number, deg: number): [number, number] {
  const rad = (deg * Math.PI) / 180;
  const x = GAUGE.cx + radius * Math.cos(rad);
  const y = GAUGE.cy + radius * Math.sin(rad);
  return [Number(x.toFixed(1)), Number(y.toFixed(1))];
}

export function arcPath(radius: number, from: number, to: number): string {
  const [x0, y0] = polar(radius, from);
  const [x1, y1] = polar(radius, to);
  const large = to - from > 180 ? 1 : 0;
  return `M ${x0.toFixed(1)} ${y0.toFixed(1)} A ${radius} ${radius} 0 ${large} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`;
}

export function majorStep(span: number): number {
  const rough = span / 8;
  const pow = 10 ** Math.floor(Math.log10(rough));
  const steps = [1, 2, 5, 10].map(mult => mult * pow);
  return steps.find(step => span / step <= 11) ?? steps[steps.length - 1] ?? rough;
}

export function textAnchor(deg: number): 'start' | 'middle' | 'end' {
  const cos = Math.cos((deg * Math.PI) / 180);
  if (cos < -0.4) return 'end';
  if (cos > 0.4) return 'start';
  return 'middle';
}
