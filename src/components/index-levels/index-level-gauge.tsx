'use client';

import { useMemo } from 'react';

import type { IndexLevelMark, IndexQuote } from '@/lib/index-levels/catalog';
import { formatMarkLabel, levelMentionDate } from '@/lib/index-levels/position';
import type { IndexLatestClose } from '@/lib/supabase/index-daily-repository';

type Phase = 'loading' | 'ready' | 'error';

/** 与预览页同一套几何：450×310 画布，圆心 (225,240)，半径 120 的半圆。 */
const CX = 225;
const CY = 240;
const R = 120;
const NEEDLE_PIVOT_Y = 214;
const SWEEP = 88;
/** 点位标注的基准半径，落在细刻度带之外。 */
const LABEL_R = 152;
const EDGE = 6;

/**
 * 当前估值位置。弧线按 E 大给出的全部点位铺开，每个点位一个圆点 + 引线 + 文字，
 * 低位 / 中枢 / 高位额外带出原文日期；指针用蓝色。
 */
export function IndexLevelGauge({
  levels,
  quotes,
  close,
  phase,
  mid,
}: {
  levels: IndexLevelMark[];
  quotes: IndexQuote[];
  close: IndexLatestClose | null;
  phase: Phase;
  /** 手工指定的中枢点位，缺省取最贴近区间中值的那个点位。 */
  mid?: number;
}) {
  const { scale, marks } = useMemo(() => buildScale(levels, quotes, mid), [levels, quotes, mid]);

  const ready = phase === 'ready' && close != null;
  const change =
    close?.previousClose == null || close.previousClose === 0
      ? null
      : ((close.close - close.previousClose) / close.previousClose) * 100;

  return (
    <section className="panel gauge-panel" aria-label="当前估值位置">
      <div className="gauge-top">
        <div className="panel-title">当前估值位置</div>
        <span className="pill">E 大点位</span>
      </div>
      <div className="gauge-wrap">
        <GaugeFace scale={scale} marks={marks} needle={ready && close ? angleAt(close.close, scale) : null} />
        <div className="gauge-center">
          <div className="gauge-value">
            {ready && close ? close.close.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
          </div>
          <div className="gauge-label">当前指数点位</div>
          <div className={change != null && change < 0 ? 'gauge-change down' : 'gauge-change'}>
            较前一交易日{' '}
            <b>{change == null ? '—' : `${change > 0 ? '+' : ''}${change.toFixed(2)}%`}</b>
          </div>
        </div>
      </div>
      {phase === 'error' ? <p className="sr">收盘暂时读不出来</p> : null}
    </section>
  );
}

function GaugeFace({
  scale,
  marks,
  needle,
}: {
  scale: Scale;
  marks: LevelView[];
  needle: number | null;
}) {
  const angleOf = (value: number) => angleAt(value, scale);
  const placed = layoutMarks(marks, angleOf);
  const majors = majorTickValues(scale);

  return (
    <svg className="gauge" viewBox="0 0 450 310" role="img" aria-label="估值区间仪表盘">
      <defs>
        <linearGradient id="index-gauge-arc" x1="0" x2="1">
          <stop offset="0" stopColor="#3d9a78" />
          <stop offset="0.5" stopColor="#e8c34d" />
          <stop offset="1" stopColor="#e05656" />
        </linearGradient>
      </defs>
      <path d={`M${CX - R} ${CY} A${R} ${R} 0 0 1 ${CX + R} ${CY}`} fill="none" stroke="#eef2f6" strokeWidth="18" strokeLinecap="round" />
      <path
        d={`M${CX - R} ${CY} A${R} ${R} 0 0 1 ${CX + R} ${CY}`}
        fill="none"
        stroke="url(#index-gauge-arc)"
        strokeWidth="6"
        strokeLinecap="round"
        opacity="0.9"
      />
      <path d={minorTickPath()} fill="none" stroke="#c3cdd8" strokeWidth="1" />
      <g stroke="#8a95a5" strokeWidth="2" strokeLinecap="round">
        {majors.map(value => {
          const inner = polar(R + 12, angleOf(value));
          const outer = polar(R + 19, angleOf(value));
          return <line key={value} x1={inner[0]} y1={inner[1]} x2={outer[0]} y2={outer[1]} />;
        })}
      </g>

      {placed.map(item => (
        <Leader key={`l-${item.key}`} item={item} others={placed} />
      ))}
      {placed.map(item => {
        const [x, y] = polar(R, item.deg);
        const anchor = item.role !== 'level';
        return (
          <circle
            key={`d-${item.key}`}
            cx={x}
            cy={y}
            r={anchor ? 3.6 : 3}
            fill="#ffffff"
            stroke={anchor ? '#1d2839' : '#7d8a9b'}
            strokeWidth={anchor ? 1.8 : 1.4}
          />
        );
      })}
      {placed.map(item => (
        <LevelLabel key={`t-${item.key}`} item={item} />
      ))}

      {needle != null ? <Needle deg={needle} /> : null}
    </svg>
  );
}

/** 圆点与文字之间的引线，文字被上下挤开时线会拐一下。 */
function Leader({ item, others }: { item: Placed; others: Placed[] }) {
  const [ax, ay] = polar(R + 21, item.deg);
  const bx = item.align === 'start' ? item.x - 4 : item.align === 'end' ? item.x + 4 : item.x;
  // 中线上的标注压在刻度带上方，引线从文字块下沿接过去，别穿过字
  const by = item.align === 'middle' ? item.y + (item.date ? 22 : 12) : item.y - 4;
  const blocked =
    item.align === 'middle' &&
    others.some(
      other =>
        other !== item &&
        other.align === 'middle' &&
        Math.abs(other.x - item.x) < 28 &&
        other.y > by - 12 &&
        other.y < ay - 4
    );
  if (blocked) return null;
  return <line x1={ax} y1={ay} x2={bx} y2={by} stroke="#d3dbe4" strokeWidth="1" strokeLinecap="round" />;
}

function Needle({ deg }: { deg: number }) {
  return (
    <g transform={`rotate(${deg.toFixed(2)} ${CX} ${NEEDLE_PIVOT_Y})`}>
      <path d={`M${CX} ${NEEDLE_PIVOT_Y - 102} L${CX + 11} ${NEEDLE_PIVOT_Y - 1} L${CX} ${NEEDLE_PIVOT_Y + 13} L${CX - 11} ${NEEDLE_PIVOT_Y - 1} Z`} fill="#3a6ff0" />
      <circle cx={CX} cy={NEEDLE_PIVOT_Y} r="6" fill="#ffffff" stroke="#3a6ff0" strokeWidth="3" />
    </g>
  );
}

function LevelLabel({ item }: { item: Placed }) {
  const anchor = item.role !== 'level';
  return (
    <g textAnchor={item.align} fontFamily="sans-serif">
      <text x={item.x} y={item.y} fill="#1d2839" fontSize={anchor ? 11.5 : 10.5} fontWeight="700">
        {item.label}
      </text>
      <text x={item.x} y={item.y + 10.5} fill="#8a95a5" fontSize="9.2">
        {item.name}
      </text>
      {anchor && item.date ? (
        <text x={item.x} y={item.y + 20} fill="#a9b2bf" fontSize="8.4">
          {item.date}
        </text>
      ) : null}
    </g>
  );
}

type Scale = { low: number; mid: number; high: number };

type LevelView = {
  key: string;
  value: number;
  label: string;
  name: string;
  date: string | null;
  role: 'low' | 'mid' | 'high' | 'level';
};

type Placed = LevelView & { deg: number; x: number; y: number; align: 'start' | 'middle' | 'end' };

/** 弧线覆盖全部点位；中枢取最贴近区间中值的点位，可用 mid 手工指定。 */
function buildScale(
  levels: IndexLevelMark[],
  quotes: IndexQuote[],
  midHint?: number
): { scale: Scale; marks: LevelView[] } {
  const sorted = [...levels].sort((a, b) => a.point - b.point);
  if (sorted.length === 0) {
    return { scale: { low: 0, mid: 50, high: 100 }, marks: [] };
  }

  const low = sorted[0].point;
  let high = sorted[sorted.length - 1].point;
  if (!(high > low)) high = low + Math.max(Math.abs(low) * 0.2, 1);

  const middle = (low + high) / 2;
  const nearest = sorted.reduce((best, level) =>
    Math.abs(level.point - middle) < Math.abs(best.point - middle) ? level : best
  );
  const mid =
    midHint != null && midHint > low && midHint < high
      ? midHint
      : nearest.point > low && nearest.point < high
        ? nearest.point
        : middle;

  const scale: Scale = { low, mid, high };

  const marks: LevelView[] = sorted.map((level, index) => {
    const role: LevelView['role'] =
      level.point === low ? 'low' : level.point === high ? 'high' : Math.abs(level.point - mid) < 1e-9 ? 'mid' : 'level';
    return {
      key: `${level.point}-${index}`,
      value: level.point,
      label: formatMarkLabel(level.label),
      name: level.name,
      date: role === 'level' ? null : levelMentionDate(level, quotes),
      role,
    };
  });

  return { scale, marks };
}

/**
 * 文字先按角度落到半径 LABEL_R 上，同一侧再按纵向最小间距挤开，
 * 保证窄角度区间里的相邻点位（比如 931 与 950）不会叠在一起。
 */
function layoutMarks(marks: LevelView[], angleOf: (value: number) => number): Placed[] {
  const placed: Placed[] = marks.map(mark => {
    const deg = angleOf(mark.value);
    const [px, py] = polar(LABEL_R, deg);
    const align: Placed['align'] = deg > 10 ? 'start' : deg < -10 ? 'end' : 'middle';
    const width = estimateWidth(mark);
    const x =
      align === 'start'
        ? Math.min(px + 3, 450 - width - EDGE)
        : align === 'end'
          ? Math.max(px - 3, width + EDGE)
          : Math.min(Math.max(px, width / 2 + EDGE), 450 - width / 2 - EDGE);
    return { ...mark, deg, x, y: py, align };
  });

  (['end', 'middle', 'start'] as const).forEach(align => {
    const side = placed.filter(item => item.align === align).sort((a, b) => a.y - b.y);
    side.forEach((item, index) => {
      const prev = side[index - 1];
      if (!prev) return;
      const need = prev.date ? 34 : 28;
      if (item.y - prev.y < need) item.y = prev.y + need;
    });
    const last = side[side.length - 1];
    if (!last) return;
    const bottom = last.y + (last.date ? 21 : 11);
    if (bottom > 296) {
      const shift = bottom - 296;
      side.forEach(item => {
        item.y -= shift;
      });
    }
    // 中线上方的标注要让开弧顶细刻度带（y≈102），两侧的标注则不要越过画布顶部
    if (align === 'middle') {
      const lastBottom = last.y + (last.date ? 21 : 11);
      if (lastBottom > 94) {
        const shift = lastBottom - 94;
        side.forEach(item => {
          item.y -= shift;
        });
      }
    } else {
      const top = side[0].y - 11;
      if (top < 60) {
        const shift = 60 - top;
        side.forEach(item => {
          item.y += shift;
        });
      }
    }
  });

  return placed;
}

/** 粗估一行文字的宽度：数字窄、汉字宽。 */
function estimateWidth(mark: LevelView): number {
  const numeric = mark.label.length * 6.1;
  const cjk = mark.name.length * 9.3;
  return Math.max(numeric, cjk, 22);
}

/** 低点 −88°、中枢 0°、高点 +88°，两侧分段线性。 */
function angleAt(value: number, scale: Scale): number {
  const { low, mid, high } = scale;
  const ratio =
    value <= mid
      ? 0.5 * ((value - low) / (mid - low || 1))
      : 0.5 + 0.5 * ((value - mid) / (high - mid || 1));
  const deg = (ratio - 0.5) * SWEEP * 2;
  return Math.max(-SWEEP, Math.min(SWEEP, deg));
}

function polar(radius: number, deg: number): [number, number] {
  const rad = (deg * Math.PI) / 180;
  return [
    Number((CX + radius * Math.sin(rad)).toFixed(1)),
    Number((CY - radius * Math.cos(rad)).toFixed(1)),
  ];
}

/** 弧线外侧每 3° 一根细刻度。 */
function minorTickPath(): string {
  let path = '';
  for (let deg = -SWEEP; deg <= SWEEP; deg += 3) {
    const inner = polar(R + 12, deg);
    const outer = polar(R + 18, deg);
    path += `M${inner[0]} ${inner[1]}L${outer[0]} ${outer[1]}`;
  }
  return path;
}

function majorTickValues(scale: Scale): number[] {
  const range = scale.high - scale.low;
  if (!(range > 0)) return [];
  const step = niceStep(range / 4);
  const start = Math.ceil((scale.low + 1e-9) / step) * step;
  const values: number[] = [];
  for (let value = start; value < scale.high; value += step) {
    values.push(Number(value.toFixed(6)));
  }
  return values;
}

function niceStep(rough: number): number {
  const mag = 10 ** Math.floor(Math.log10(Math.max(rough, 1e-6)));
  const err = rough / mag;
  const mult = err <= 1 ? 1 : err <= 2 ? 2 : err <= 2.5 ? 2.5 : err <= 5 ? 5 : 10;
  return mult * mag;
}
