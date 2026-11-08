'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { filterCloseSpan, type CloseSpan, type IndexClosePoint } from '@/lib/index-levels/close-series';
import type { EtfTradeMark } from '@/lib/index-levels/media-etf-trades';

const SPANS: Array<{ id: CloseSpan; label: string }> = [
  { id: 'all', label: '上市以来' },
  { id: '10', label: '近 10 年' },
  { id: '5', label: '近 5 年' },
];

/** 语义色直接消费 .index-levels 令牌（presentation 属性不认 var，用 style 应用）：
    绿=买入/低估，红=卖出/高估（A股语系）；买入徽章比价格线的哑光绿更鲜，信号要比曲线响。 */
const PRICE = 'var(--green)';
const BUY = 'var(--green-badge)';
const SELL = 'var(--red)';
const MIN_WINDOW = 15;

type Geom = {
  width: number;
  height: number;
  left: number;
  top: number;
  innerW: number;
  innerH: number;
  xs: number[];
  ys: number[];
  ticks: Array<{ value: number; y: number; label: string }>;
  years: Array<{ x: number; year: string }>;
  line: string;
  area: string;
  marks: Array<{ x: number; y: number; side: 'buy' | 'sell'; price: number; date: string; index: number }>;
};

const digitsOf = (priceDigits?: number): number => priceDigits ?? 2;

/** 标题。场外基金把中文名称链到且慢，代码仍是普通文本。 */
function ChartTitle({ name, code, href }: { name: string; code: string; href?: string }) {
  const codeNode = <span className="code">{code}</span>;
  if (!href) {
    return (
      <>
        {name} {codeNode}
      </>
    );
  }
  return (
    <>
      <a className="name-link" href={href} target="_blank" rel="noreferrer">
        {name}
      </a>
      {codeNode}
    </>
  );
}

/**
 * 收盘折线。走势线深绿配渐变面积，买卖点用 B/S 圆形徽章。
 * 滚轮缩放、拖拽平移、双击复位，与预览页一致。
 */
export function IndexLevelChart({
  name,
  code,
  points,
  phase,
  marks = [],
  priceDigits,
  wide = false,
  titleHelp,
  codeHref,
}: {
  name: string;
  code: string;
  points: IndexClosePoint[];
  phase: 'loading' | 'ready' | 'error';
  /** 画在收盘线上的买卖点。 */
  marks?: EtfTradeMark[];
  /** 悬停收盘的小数位。 */
  priceDigits?: number;
  /** ETF / 联接基金用整行宽版卡片。 */
  wide?: boolean;
  /** 标题旁的说明，例如问号提示。 */
  titleHelp?: ReactNode;
  /** 代码外链。缺省时代码只作文本。 */
  codeHref?: string;
}) {
  const [span, setSpan] = useState<CloseSpan>('all');
  const [view, setView] = useState<[number, number] | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [hover, setHover] = useState<{ index: number; left: number; top: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  const hostRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; view: [number, number]; moved: boolean } | null>(null);

  const full = useMemo(() => filterCloseSpan(points, span), [points, span]);
  const win = useMemo<[number, number]>(() => {
    if (!view || view[1] - view[0] < 2 || view[1] > full.length) return [0, full.length];
    return view;
  }, [view, full.length]);
  const rows = useMemo(() => full.slice(win[0], win[1]), [full, win]);

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    const measure = () => {
      const width = host.clientWidth;
      const height = host.clientHeight;
      setSize(current =>
        Math.abs(current.width - width) < 1 && Math.abs(current.height - height) < 1 ? current : { width, height }
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  const geom = useMemo(() => buildGeom(rows, code, marks, size), [rows, code, marks, size]);
  const digits = digitsOf(priceDigits);
  const last = rows[rows.length - 1];

  const zoomAt = useCallback(
    (clientX: number, deltaY: number) => {
      const host = hostRef.current;
      if (!host) return;
      const len = full.length;
      const width = host.clientWidth;
      const left = geom.left;
      const right = 14;
      const rect = host.getBoundingClientRect();
      const frac = Math.min(1, Math.max(0, (((clientX - rect.left) / (rect.width || 1)) * width - left) / (width - left - right || 1)));
      const [start, end] = win;
      const oldLen = end - start;
      const newLen = Math.max(MIN_WINDOW, Math.min(len, Math.round(oldLen * (deltaY > 0 ? 1.25 : 0.8))));
      if (newLen === oldLen) return;
      let ns = start + frac * (oldLen - newLen);
      ns = Math.max(0, Math.min(len - newLen, ns));
      setView([Math.round(ns), Math.round(ns + newLen)]);
    },
    [full.length, geom.left, win]
  );

  useEffect(() => {
    const svg = hostRef.current?.querySelector('svg');
    if (!svg) return undefined;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      zoomAt(event.clientX, event.deltaY);
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, [zoomAt]);

  useEffect(() => {
    const stop = () => {
      drag.current = null;
      setDragging(false);
    };
    window.addEventListener('mouseup', stop);
    return () => window.removeEventListener('mouseup', stop);
  }, []);

  const onMouseMove = (event: React.MouseEvent<SVGSVGElement>) => {
    const svg = event.currentTarget;
    const rect = svg.getBoundingClientRect();
    const scale = geom.width / (rect.width || 1);
    const x = (event.clientX - rect.left) * scale;

    const state = drag.current;
    if (state && geom.width > 0) {
      const dx = event.clientX - state.x;
      if (Math.abs(dx) > 3) state.moved = true;
      if (state.moved) {
        const innerW = geom.width - geom.left - 14;
        const winLen = state.view[1] - state.view[0];
        let start = state.view[0] - Math.round((dx / innerW) * winLen);
        start = Math.max(0, Math.min(full.length - winLen, start));
        if (start !== state.view[0]) {
          state.view = [start, start + winLen];
          setView([start, start + winLen]);
        }
      }
      return;
    }

    if (x < geom.left || x > geom.width - 14 || rows.length === 0) {
      setHover(null);
      return;
    }
    // 落在 B/S 徽章上时直接取那个买卖点，指标点太密时也能读到成交价。
    const badge = geom.marks.find(mark => Math.abs(mark.x - x) <= 6);
    const index = badge ? badge.index : nearestIndex(geom.xs, x);
    const tipWidth = 190;
    const host = hostRef.current;
    const hostRect = host?.getBoundingClientRect();
    let left = event.clientX - (hostRect?.left ?? rect.left) + 14;
    if (host && left + tipWidth > host.clientWidth - 8) {
      left = event.clientX - (hostRect?.left ?? rect.left) - tipWidth - 14;
    }
    const top = Math.max(4, event.clientY - (hostRect?.top ?? rect.top) - 118);
    setHover({ index, left, top });
  };

  const ariaLabel = wide ? `${name}收盘折线与策略信号` : `${name}历史走势`;

  return (
    <section className={wide ? 'panel wide-chart section' : 'panel chart-panel'}>
      <div className="panel-head">
        <div className="panel-title">
          <ChartTitle name={name} code={code} href={codeHref} />
          {titleHelp ? <span className="title-help">{titleHelp}</span> : null}
        </div>
        <div className="tabs">
          {SPANS.map(item => (
            <button
              key={item.id}
              type="button"
              className={span === item.id ? 'tab active' : 'tab'}
              onClick={() => {
                setSpan(item.id);
                setView(null);
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <div className="chart-host" ref={hostRef}>
        <svg
          className={dragging ? 'chart dragging' : 'chart'}
          viewBox={`0 0 ${Math.max(geom.width, 1)} ${Math.max(geom.height, 1)}`}
          role="img"
          aria-label={ariaLabel}
          onMouseMove={onMouseMove}
          onMouseLeave={() => setHover(null)}
          onMouseDown={event => {
            drag.current = { x: event.clientX, view: win, moved: false };
            setDragging(true);
          }}
          onDoubleClick={() => setView(null)}
        >
          <ChartPlot
            geom={geom}
            code={code}
            hoverIndex={hover?.index ?? null}
            hoverLabel={hover && rows[hover.index] ? fmtClose(rows[hover.index].close, digits) : null}
          />
        </svg>
        {hover && rows[hover.index] ? (
          <div className="tip show" style={{ left: hover.left, top: hover.top }}>
            <TipBody
              name={name}
              code={code}
              rows={rows}
              index={hover.index}
              digits={digits}
              mark={geom.marks.find(item => item.index === hover.index)}
            />
          </div>
        ) : null}
      </div>
      <div className="chart-foot">{last ? <span>更新至 {slashDate(last.tradeDate)}</span> : null}</div>
      {phase === 'loading' ? <p className="sr">读取收盘</p> : null}
      {phase === 'error' ? <p className="sr">收盘暂时读不出来</p> : null}
    </section>
  );
}

function ChartPlot({
  geom,
  code,
  hoverIndex,
  hoverLabel,
}: {
  geom: Geom;
  code: string;
  hoverIndex: number | null;
  hoverLabel: string | null;
}) {
  if (geom.width < 40 || geom.height < 40) return null;
  const gradientId = `area-${code.replace(/[^a-zA-Z0-9]/g, '')}`;
  const hoverX = hoverIndex != null ? geom.xs[hoverIndex] : null;
  const hoverY = hoverIndex != null ? geom.ys[hoverIndex] : null;
  const showCross = hoverX != null && hoverY != null;
  return (
    <g>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: PRICE }} stopOpacity="0.15" />
          <stop offset="1" style={{ stopColor: PRICE }} stopOpacity="0" />
        </linearGradient>
      </defs>
      {geom.ticks.map(tick => (
        <g key={tick.value}>
          <line className="gridline" x1={geom.left} y1={tick.y} x2={geom.width - 14} y2={tick.y} />
          <text x={geom.left - 8} y={tick.y + 3} textAnchor="end">
            {tick.label}
          </text>
        </g>
      ))}
      {geom.years.map(item => (
        <text key={item.year + item.x} x={item.x} y={geom.height - 8} textAnchor="middle">
          {item.year}
        </text>
      ))}
      <path fill={`url(#${gradientId})`} d={geom.area} />
      <path className="price-line" d={geom.line} />
      <line
        className="marker-line hover-line"
        x1={hoverX ?? 0}
        y1={geom.top}
        x2={hoverX ?? 0}
        y2={geom.top + geom.innerH}
        visibility={showCross ? 'visible' : 'hidden'}
      />
      <line
        className="marker-line hover-line"
        x1={geom.left}
        y1={hoverY ?? 0}
        x2={geom.width - 14}
        y2={hoverY ?? 0}
        visibility={showCross ? 'visible' : 'hidden'}
      />
      {showCross && hoverLabel ? (
        <text className="hover-label" x={geom.left - 8} y={(hoverY ?? 0) + 3} textAnchor="end">
          {hoverLabel}
        </text>
      ) : null}
      {geom.marks.map(mark => (
        <g className="trade-mark" key={`${mark.side}-${mark.date}`}>
          <circle cx={mark.x} cy={mark.y - 12} r="7.5" style={{ fill: mark.side === 'buy' ? BUY : SELL }} />
          <text
            x={mark.x}
            y={mark.y - 9.2}
            textAnchor="middle"
            fontSize="8.5"
            fontWeight="700"
            fill="#ffffff"
            style={{ pointerEvents: 'none' }}
          >
            {mark.side === 'buy' ? 'B' : 'S'}
          </text>
        </g>
      ))}
    </g>
  );
}

function TipBody({
  name,
  code,
  rows,
  index,
  digits,
  mark,
}: {
  name: string;
  code: string;
  rows: IndexClosePoint[];
  index: number;
  digits: number;
  mark?: { side: 'buy' | 'sell'; price: number };
}) {
  const point = rows[index];
  if (!point) return null;
  let peak = 0;
  for (let i = 0; i <= index; i += 1) peak = Math.max(peak, rows[i].close);
  const base = rows[0]?.close ?? point.close;
  const cumulative = base === 0 ? 0 : (point.close / base - 1) * 100;
  const fromPeak = peak > 0 ? (point.close / peak - 1) * 100 : 0;
  return (
    <>
      <div className="tip-title">
        <i className="tip-dot" />
        <b>
          {name} ({code})
        </b>
      </div>
      <div className="tip-date">{point.tradeDate}</div>
      <div>
        <em>收盘价</em>
        {fmtClose(point.close, digits)}
      </div>
      <div>
        <em>历史累计涨跌</em>
        <Pct value={cumulative} />
      </div>
      <div>
        <em>距前高下跌</em>
        <Pct value={fromPeak} />
      </div>
      {mark ? (
        <div className={mark.side === 'buy' ? 'tip-trade buy' : 'tip-trade sell'}>
          <em>{mark.side === 'buy' ? '买入 B' : '卖出 S'}</em>
          {fmtClose(mark.price, digits)}
        </div>
      ) : null}
    </>
  );
}

function Pct({ value }: { value: number }) {
  const kind = value < -0.005 ? 'down' : value > 0.005 ? 'up' : 'flat';
  return <span className={kind}>{`${value > 0 ? '+' : ''}${value.toFixed(2)}%`}</span>;
}

type GeomTick = { value: number; y: number; label: string };

function buildGeom(
  rows: IndexClosePoint[],
  code: string,
  marks: EtfTradeMark[],
  size: { width: number; height: number }
): Geom {
  const empty: Geom = {
    width: size.width,
    height: size.height,
    left: 0,
    top: 0,
    innerW: 0,
    innerH: 0,
    xs: [],
    ys: [],
    ticks: [] as GeomTick[],
    years: [],
    line: '',
    area: '',
    marks: [],
  };
  if (size.width < 40 || size.height < 40 || rows.length === 0) return empty;

  const left = code === 'USDCNH.OTH' || !isIndexLike(code, rows) ? 46 : 40;
  const right = 14;
  const top = 18;
  const bottom = 32;
  const innerW = size.width - left - right;
  const innerH = size.height - top - bottom;
  const [y0, y1] = domainOf(rows, code);
  const xAt = (index: number) =>
    left + (rows.length === 1 ? innerW / 2 : (index / (rows.length - 1)) * innerW);
  const yAt = (value: number) => top + (1 - (value - y0) / (y1 - y0 || 1)) * innerH;

  const ticks = ticksOf(y0, y1).map(value => ({ value, y: yAt(value), label: labelOf(value, code, rows) }));
  const years: Array<{ x: number; year: string }> = [];
  let lastX = -999;
  let lastYear = '';
  rows.forEach((row, index) => {
    const year = row.tradeDate.slice(0, 4);
    if (year === lastYear) return;
    lastYear = year;
    const x = xAt(index);
    if (x - lastX < 56 && index !== 0) return;
    lastX = x;
    years.push({ x, year });
  });

  const xs: number[] = [];
  const ys: number[] = [];
  let line = '';
  rows.forEach((row, index) => {
    const x = xAt(index);
    const y = yAt(row.close);
    xs.push(x);
    ys.push(y);
    line += `${index === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)} `;
  });
  const baseY = (top + innerH).toFixed(2);
  const area = `${line.trim()} L${(xs[xs.length - 1] ?? left).toFixed(2)} ${baseY} L${(xs[0] ?? left).toFixed(2)} ${baseY} Z`;

  const placed = snapTrades(rows, marks);
  const places: Geom['marks'] = [];
  placed.forEach((mark, date) => {
    const index = rows.findIndex(row => row.tradeDate === date);
    if (index < 0) return;
    places.push({ x: xAt(index), y: yAt(rows[index].close), side: mark.side, price: mark.price, date, index });
  });

  return { width: size.width, height: size.height, left, top, innerW, innerH, xs, ys, ticks, years, line, area, marks: places };
}

function isIndexLike(code: string, rows: IndexClosePoint[]): boolean {
  if (code.includes('.OTH')) return true;
  const peak = rows.reduce((max, row) => Math.max(max, row.close), 0);
  return peak >= 100;
}

/** 纵轴范围。美元兑人民币从 6 起，避免汇率被压在从 0 起的指数轴顶端。 */
export function domainOf(rows: IndexClosePoint[], code: string): [number, number] {
  const max = rows.reduce((peak, row) => Math.max(peak, row.close), 0);
  if (code === 'USDCNH.OTH') return [6, Math.max(axisTop(max), 7)];
  if (isIndexLike(code, rows)) return [0, axisTop(max)];
  const min = rows.reduce((floor, row) => Math.min(floor, row.close), max);
  const pad = Math.max((max - min) * 0.08, max * 0.01);
  return [Math.max(0, min - pad), max + pad];
}

function axisTop(max: number): number {
  const rough = Math.max(max / 4, 1);
  const mag = 10 ** Math.floor(Math.log10(rough));
  const err = rough / mag;
  const step = (err <= 1 ? 1 : err <= 2 ? 2 : err <= 2.5 ? 2.5 : err <= 5 ? 5 : 10) * mag;
  return Math.max(step, Math.ceil(max / step) * step);
}

function ticksOf(min: number, max: number): number[] {
  const rough = (max - min) / 4;
  const mag = 10 ** Math.floor(Math.log10(Math.max(rough, 1e-6)));
  const err = rough / mag;
  const step = (err <= 1 ? 1 : err <= 2 ? 2 : err <= 2.5 ? 2.5 : err <= 5 ? 5 : 10) * mag;
  const start = Math.ceil((min - 1e-9) / step) * step;
  const ticks: number[] = [];
  for (let value = start; value <= max + step * 0.001; value += step) ticks.push(Number(value.toFixed(6)));
  return ticks;
}

/** 纵轴刻度文字。汇率保留两位小数，指数仍取整。 */
export function labelOf(value: number, code: string, rows: IndexClosePoint[]): string {
  if (code === 'USDCNH.OTH' || !isIndexLike(code, rows)) return value.toFixed(2);
  if (value === 0) return '0';
  if (value >= 1000 && value % 1000 === 0) return `${value / 1000}K`;
  if (value >= 1000) return `${(value / 1000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(Math.round(value));
}

function snapTrades(rows: IndexClosePoint[], marks: EtfTradeMark[]): Map<string, EtfTradeMark> {
  const dates = rows.map(row => row.tradeDate);
  const placed = new Map<string, EtfTradeMark>();
  const pending: EtfTradeMark[] = [];
  marks.forEach(mark => {
    if (dates.includes(mark.tradeDate)) placed.set(mark.tradeDate, mark);
    else pending.push(mark);
  });
  pending.forEach(mark => {
    const target = Date.parse(`${mark.tradeDate}T00:00:00Z`);
    let best: string | null = null;
    let gap = 5;
    dates.forEach(date => {
      if (placed.has(date)) return;
      const days = Math.abs(Date.parse(`${date}T00:00:00Z`) - target) / 86400000;
      if (days < gap) {
        best = date;
        gap = days;
      }
    });
    if (best) placed.set(best, mark);
  });
  return placed;
}

function nearestIndex(xs: number[], x: number): number {
  let lo = 0;
  let hi = xs.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (xs[mid] < x) lo = mid + 1;
    else hi = mid;
  }
  if (lo > 0 && Math.abs(xs[lo - 1] - x) < Math.abs(xs[lo] - x)) return lo - 1;
  return lo;
}

function fmtClose(value: number, digits: number): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function slashDate(value: string): string {
  return value.replaceAll('-', '/');
}
