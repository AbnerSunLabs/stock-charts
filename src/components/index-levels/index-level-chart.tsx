"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { Spin } from "antd";

import {
  filterCloseSpan,
  type CloseSpan,
  type IndexClosePoint,
} from "@/lib/index-levels/close-series";
import {
  buyPointNote,
  type BuyPointNote,
  type EtfTradeMark,
} from "@/lib/index-levels/media-etf-trades";
import {
  peHoverStats,
  type PeHoverStats,
  type PePoint,
} from "@/lib/index-levels/pe-series";

/** 区间档位表：tracker 的 localStorage 恢复校验也用它（单一事实来源） */
export const CLOSE_SPANS: Array<{ id: CloseSpan; label: string }> = [
  { id: "all", label: "有记录以来" },
  { id: "10", label: "近 10 年" },
  { id: "5", label: "近 5 年" },
];

const SPANS = CLOSE_SPANS;

/** 折线用聚焦页的靛色。买卖徽章仍是 A 股语系：买入绿、卖出红。 */
const LINE = "#8183d8";
const PE_LINE = "#c4a15a";
const BUY = "#05b169";
const SELL = "#cf202f";
const MIN_WINDOW = 15;
const PLOT_TOP = 16;
const PLOT_BOTTOM = 28;
const PLOT_RIGHT = 24;
const NO_LEVELS: number[] = [];

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
  /** 右轴市盈率。没有估值时为空字符串。 */
  peLine: string;
  peTicks: Array<{ value: number; y: number; label: string }>;
  levelY: number | null;
  /** 最新收盘的琥珀线与右侧价格。窗口没落到最新一天时为空。 */
  now: { x: number; y: number; tagY: number; label: string } | null;
  marks: Array<{
    x: number;
    y: number;
    side: "buy" | "sell";
    price: number;
    date: string;
    index: number;
    note: BuyPointNote | null;
  }>;
};

const digitsOf = (priceDigits?: number): number => priceDigits ?? 2;

/** 标题。场外基金把中文名称链到且慢，代码仍是普通文本。 */
function ChartTitle({
  name,
  code,
  href,
}: {
  name: string;
  code: string;
  href?: string;
}) {
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

/** 折线还没到时占住图高，用 Ant Design 的 Spin。 */
function ChartLoading() {
  return (
    <div className="chart chart-loading">
      <Spin tip="正在读取收盘…">
        <div className="chart-loading-holder" />
      </Spin>
    </div>
  );
}

/** 出错态与加载态同构淡入，并带上「重新加载」入口（复用各自的加载函数）。 */
function ChartError({ label, onRetry }: { label: string; onRetry?: () => void }) {
  return (
    <div className="chart chart-error" role="status">
      <span>{label}</span>
      {onRetry ? (
        <button type="button" className="chart-retry" onClick={onRetry}>
          重新加载
        </button>
      ) : null}
    </div>
  );
}

/**
 * 时间范围分段：等宽分段 + 白色滑块 thumb。
 * 状态变化「切换时间范围」由 thumb 的 translateX 滑动交代（CSS 见 .tab-thumb）。
 */
export function SpanTabs({
  span,
  onChange,
  ariaLabel = "时间范围",
}: {
  span: CloseSpan;
  onChange: (next: CloseSpan) => void;
  ariaLabel?: string;
}) {
  const activeIndex = Math.max(
    0,
    SPANS.findIndex((item) => item.id === span),
  );
  const thumbStyle = { "--tab-index": activeIndex } as CSSProperties;
  return (
    <div className="tabs" role="group" aria-label={ariaLabel}>
      <span className="tab-thumb" aria-hidden="true" style={thumbStyle} />
      {SPANS.map((item) => (
        <button
          key={item.id}
          type="button"
          className={span === item.id ? "tab active" : "tab"}
          aria-pressed={span === item.id}
          onClick={() => onChange(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
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
  errorLabel = "收盘数据暂时无法读取",
  onRetry,
  marks = [],
  priceDigits,
  wide = false,
  titleHelp,
  codeHref,
  bare = false,
  span: spanProp,
  axisFromZero = false,
  levels = NO_LEVELS,
  activeLevel = null,
  onActiveLevel,
  presliced = false,
  peHistory = [],
}: {
  name: string;
  code: string;
  points: IndexClosePoint[];
  phase: "loading" | "ready" | "error";
  errorLabel?: string;
  /** 出错态的「重新加载」回调：复用父级各自的加载函数。 */
  onRetry?: () => void;
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
  /** 只画折线，标题和时间范围由页面统一放。 */
  bare?: boolean;
  /** 页面统一的时间范围。传入后图内不再画分段按钮。 */
  span?: CloseSpan;
  /** 有记录以来且未缩放时，纵轴从 0 起。 */
  axisFromZero?: boolean;
  /** 纳入纵轴的判断点位。 */
  levels?: number[];
  /** 当前选中的判断点位，画出虚线。 */
  activeLevel?: number | null;
  /** 点击虚线时切换这一档。 */
  onActiveLevel?: () => void;
  /** 点数已经按页面时间范围切过，图内不再按自身最后一天重切。 */
  presliced?: boolean;
  /**
   * 全历史市盈率，用来算悬停分位。
   * 可见窗口只决定折线，分位不能跟着「近 5 年」被截短。
   */
  peHistory?: PePoint[];
}) {
  const [innerSpan, setSpan] = useState<CloseSpan>("5");
  const span = spanProp ?? innerSpan;
  const [view, setView] = useState<[number, number] | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [hover, setHover] = useState<{
    index: number;
    left: number;
    top: number;
  } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [seriesOn, setSeriesOn] = useState({ price: true, pe: true });

  const hostRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const indexTip = /\.(SH|SZ|CSI|HI|OTH)$/.test(code);
  const drag = useRef<{
    x: number;
    view: [number, number];
    moved: boolean;
  } | null>(null);

  const full = useMemo(
    () => (presliced ? points : filterCloseSpan(points, span)),
    [points, span, presliced],
  );
  const win = useMemo<[number, number]>(() => {
    if (!view || view[1] - view[0] < 2 || view[1] > full.length)
      return [0, full.length];
    return view;
  }, [view, full.length]);
  const rows = useMemo(() => full.slice(win[0], win[1]), [full, win]);

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    const measure = () => {
      const width = host.clientWidth;
      const height = host.clientHeight;
      setSize((current) =>
        Math.abs(current.width - width) < 1 &&
        Math.abs(current.height - height) < 1
          ? current
          : { width, height },
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  /** 提示卡尺寸缓存：内容变高/变矮后钳位也只算一次，直接写 transform，不再二次 setState。 */
  const tipSizeRef = useRef({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const tip = tipRef.current;
    const host = hostRef.current;
    if (!tip || !host) return;
    const width = tip.offsetWidth;
    const height = tip.offsetHeight;
    // 仅在提示卡真实显示（有悬停内容）时缓存尺寸：隐藏态内容已卸载，
    // 量到的只有内边距尺寸，写进缓存会污染靠近右缘时的翻面判定。
    if (hover && width > 0 && height > 0) tipSizeRef.current = { width, height };
    if (!hover) return;
    const left = Math.max(8, Math.min(hover.left, host.clientWidth - width - 8));
    const hostTop = host.getBoundingClientRect().top;
    // 手机图高可能小于完整提示卡，允许向上展开，优先保证视口内可读。
    const top = Math.max(
      8 - hostTop,
      Math.min(hover.top, host.clientHeight - height - 4, window.innerHeight - hostTop - height - 8),
    );
    // 定位统一走 translate3d（不写 left/top），绘制前一次性落位消除二次跳位。
    tip.style.transform = `translate3d(${left}px, ${top}px, 0)`;
  }, [hover, size, seriesOn.pe, peHistory, phase]);

  const digits = digitsOf(priceDigits);
  const fromZero =
    axisFromZero &&
    span === "all" &&
    (view == null || (win[0] === 0 && win[1] === full.length));
  const geom = useMemo(
    () =>
      buildGeom(rows, code, marks, size, {
        fromZero,
        extras: levels,
        digits,
        level: activeLevel,
        showNow:
          levels.length > 0 &&
          rows[rows.length - 1]?.tradeDate === full[full.length - 1]?.tradeDate,
      }),
    [
      rows,
      code,
      marks,
      size,
      fromZero,
      levels,
      digits,
      activeLevel,
      full,
    ],
  );
  const last = rows[rows.length - 1];

  const zoomAt = useCallback(
    (clientX: number, deltaY: number) => {
      const host = hostRef.current;
      if (!host) return;
      const len = full.length;
      const width = host.clientWidth;
      const left = geom.left;
      const rect = host.getBoundingClientRect();
      const plotRight = geom.width - geom.left - geom.innerW;
      const frac = Math.min(
        1,
        Math.max(
          0,
          (((clientX - rect.left) / (rect.width || 1)) * width - left) /
            (width - left - plotRight || 1),
        ),
      );
      const [start, end] = win;
      const oldLen = end - start;
      const newLen = Math.max(
        MIN_WINDOW,
        Math.min(len, Math.round(oldLen * (deltaY > 0 ? 1.25 : 0.8))),
      );
      if (newLen === oldLen) return;
      let ns = start + frac * (oldLen - newLen);
      ns = Math.max(0, Math.min(len - newLen, ns));
      setView([Math.round(ns), Math.round(ns + newLen)]);
    },
    [full.length, geom.left, geom.innerW, geom.width, win],
  );

  useEffect(() => {
    setView(null);
    setHover(null);
  }, [span]);

  useEffect(() => {
    setHover(null);
    setSeriesOn({ price: true, pe: true });
  }, [code]);

  useEffect(() => {
    const svg = hostRef.current?.querySelector("svg");
    if (!svg) return undefined;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      zoomAt(event.clientX, event.deltaY);
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  useEffect(() => {
    const stop = () => {
      drag.current = null;
      setDragging(false);
    };
    window.addEventListener("mouseup", stop);
    return () => window.removeEventListener("mouseup", stop);
  }, []);

  const onPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const svg = event.currentTarget;
    const rect = svg.getBoundingClientRect();
    const scale = geom.width / (rect.width || 1);
    const x = (event.clientX - rect.left) * scale;

    const state = drag.current;
    if (state && geom.width > 0) {
      const dx = event.clientX - state.x;
      if (Math.abs(dx) > 3) state.moved = true;
      if (state.moved) {
        const innerW = geom.innerW;
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

    if (x < geom.left || x > geom.left + geom.innerW || rows.length === 0) {
      setHover(null);
      return;
    }
    // 落在 B/S 徽章上时直接取那个买卖点，指标点太密时也能读到成交价。
    const badge = geom.marks.find((mark) => Math.abs(mark.x - x) <= 6);
    const index = badge ? badge.index : nearestIndex(geom.xs, x);
    const showPeTip =
      seriesOn.pe &&
      peHistory.some((point) => point.tradeDate === rows[index]?.tradeDate);
    // 优先用上次实测宽度决定翻面，避免首拍按估算值翻错边。
    const tipWidth =
      tipSizeRef.current.width ||
      (indexTip ? 280 : showPeTip ? 260 : badge?.note ? 320 : 190);
    const host = hostRef.current;
    const hostRect = host?.getBoundingClientRect();
    let left = event.clientX - (hostRect?.left ?? rect.left) + 14;
    if (host && left + tipWidth > host.clientWidth - 8) {
      left = event.clientX - (hostRect?.left ?? rect.left) - tipWidth - 14;
    }
    const lift = indexTip
      ? showPeTip ? 370 : 150
      : showPeTip ? 292 : badge?.note ? 168 : 118;
    const top = Math.max(4, event.clientY - (hostRect?.top ?? rect.top) - lift);
    setHover({ index, left, top });
  };

  const ariaLabel = wide ? `${name}收盘折线与策略信号` : `${name}历史走势`;
  const plot = (
    <>
      <div className="chart-host" ref={hostRef}>
        {phase === "loading" ? (
          <ChartLoading />
        ) : phase === "error" ? (
          <ChartError label={errorLabel} onRetry={onRetry} />
        ) : (
          <>
            <svg
              className={dragging ? "chart dragging" : "chart"}
              viewBox={`0 0 ${Math.max(geom.width, 1)} ${Math.max(geom.height, 1)}`}
              role="img"
              aria-label={ariaLabel}
              onPointerMove={onPointerMove}
              onPointerLeave={event => {
                if (event.pointerType !== "touch") setHover(null);
              }}
              onPointerDown={event => {
                if (event.pointerType === "touch") {
                  onPointerMove(event);
                  return;
                }
                drag.current = { x: event.clientX, view: win, moved: false };
                setDragging(true);
              }}
              onDoubleClick={() => setView(null)}
            >
              <ChartPlot
                geom={geom}
                code={code}
                showPrice={seriesOn.price}
                showPe={seriesOn.pe}
                hoverIndex={hover?.index ?? null}
                hoverLabel={
                  hover && rows[hover.index]
                    ? fmtClose(rows[hover.index].close, digits)
                    : null
                }
                onActiveLevel={onActiveLevel}
              />
            </svg>
            <div
              ref={tipRef}
              className={indexTip ? "tip index-tip" : "tip"}
              data-show={hover && rows[hover.index] ? "true" : "false"}
              role="tooltip"
            >
              <div className="tip-card">
                {hover && rows[hover.index] ? (
                  <TipBody
                    name={name}
                    code={code}
                    rows={rows}
                    index={hover.index}
                    digits={digits}
                    indexTip={indexTip}
                    rangePoints={full}
                    mark={geom.marks.find((item) => item.index === hover.index)}
                    pe={
                      seriesOn.pe
                        ? peHoverStats(
                            peHistory,
                            rows[hover.index]?.tradeDate ?? "",
                          )
                        : null
                    }
                  />
                ) : null}
              </div>
            </div>
          </>
        )}
      </div>
      {phase === "ready" && peHistory.length > 0 ? (
        <SeriesLegend
          priceOn={seriesOn.price}
          peOn={seriesOn.pe}
          onToggle={(key) =>
            setSeriesOn((current) => ({ ...current, [key]: !current[key] }))
          }
        />
      ) : null}
      {bare ? null : (
        <div className="chart-foot">
          {last ? <span>更新至 {slashDate(last.tradeDate)}</span> : null}
        </div>
      )}
    </>
  );

  if (bare) return plot;

  return (
    <section
      className={wide ? "panel wide-chart section" : "panel chart-panel"}
    >
      <div className="panel-head">
        <div className="panel-title">
          <ChartTitle name={name} code={code} href={codeHref} />
          {titleHelp ? <span className="title-help">{titleHelp}</span> : null}
        </div>
        {spanProp == null ? (
          <SpanTabs
            span={span}
            onChange={(next) => {
              setSpan(next);
              setView(null);
            }}
          />
        ) : null}
      </div>
      {plot}
    </section>
  );
}

function ChartPlot({
  geom,
  code,
  showPrice,
  showPe,
  hoverIndex,
  hoverLabel,
  onActiveLevel,
}: {
  geom: Geom;
  code: string;
  showPrice: boolean;
  showPe: boolean;
  hoverIndex: number | null;
  hoverLabel: string | null;
  onActiveLevel?: () => void;
}) {
  if (geom.width < 40 || geom.height < 40) return null;
  const gradientId = `area-${code.replace(/[^a-zA-Z0-9]/g, "")}`;
  const hoverX = hoverIndex != null ? geom.xs[hoverIndex] : null;
  const hoverY = hoverIndex != null ? geom.ys[hoverIndex] : null;
  const showCross = hoverX != null && hoverY != null;
  return (
    <g>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: LINE }} stopOpacity="0.08" />
          <stop offset="1" style={{ stopColor: LINE }} stopOpacity="0" />
        </linearGradient>
      </defs>
      {geom.ticks.map((tick) => (
        <g key={tick.value}>
          <line
            className="gridline"
            x1={geom.left}
            y1={tick.y}
            x2={geom.left + geom.innerW}
            y2={tick.y}
          />
        </g>
      ))}
      {/* 状态变化：图例开关「点位」= 左轴文字常挂载，只切 opacity 淡出淡入。 */}
      <g className="layer-price" style={{ opacity: showPrice ? 1 : 0 }}>
        {geom.ticks.map((tick) => (
          <text key={tick.value} x={geom.left - 8} y={tick.y + 3} textAnchor="end">
            {tick.label}
          </text>
        ))}
      </g>
      {/* 状态变化：图例开关「市盈率」= 右轴文字常挂载，只切 opacity。 */}
      <g className="layer-pe" style={{ opacity: showPe ? 1 : 0 }}>
        {geom.peTicks.map((tick) => (
          <text
            key={`pe-${tick.value}`}
            className="pe-tick"
            x={geom.left + geom.innerW + 8}
            y={tick.y + 3}
          >
            {tick.label}
          </text>
        ))}
      </g>
      {geom.years.map((item) => (
        <text
          key={item.year + item.x}
          x={item.x}
          y={geom.height - 8}
          textAnchor="middle"
        >
          {item.year}
        </text>
      ))}
      <g className="layer-price" style={{ opacity: showPrice ? 1 : 0 }}>
        <path fill={`url(#${gradientId})`} d={geom.area} />
        <path className="price-line" d={geom.line} />
      </g>
      {geom.peLine ? (
        <g className="layer-pe" style={{ opacity: showPe ? 1 : 0 }}>
          <path className="pe-line" d={geom.peLine} stroke={PE_LINE} />
        </g>
      ) : null}
      {/* 状态变化：切换对照档位 = 虚线整组沿 Y 平移到新档（y1/y2 不可过渡，包一层 g 用 transform）。 */}
      {geom.levelY != null ? (
        <g
          className="key-level"
          onClick={onActiveLevel}
          style={{ transform: `translate(0px, ${geom.levelY.toFixed(2)}px)` }}
        >
          <line
            x1={geom.left}
            y1={0}
            x2={geom.left + geom.innerW}
            y2={0}
            strokeWidth={1.2}
            strokeDasharray="5 6"
          />
          <circle cx={geom.left + geom.innerW - 5} cy={0} r={3} />
          <line
            x1={geom.left}
            y1={0}
            x2={geom.left + geom.innerW}
            y2={0}
            stroke="transparent"
            strokeWidth={12}
          />
        </g>
      ) : null}
      <line
        className="marker-line hover-line"
        x1={hoverX ?? 0}
        y1={geom.top}
        x2={hoverX ?? 0}
        y2={geom.top + geom.innerH}
        visibility={showCross ? "visible" : "hidden"}
      />
      <line
        className="marker-line hover-line"
        x1={geom.left}
        y1={hoverY ?? 0}
        x2={geom.left + geom.innerW}
        y2={hoverY ?? 0}
        visibility={showPrice && showCross ? "visible" : "hidden"}
      />
      {showPrice && showCross && hoverLabel ? (
        <text
          className="hover-label"
          x={geom.left - 8}
          y={(hoverY ?? 0) + 3}
          textAnchor="end"
        >
          {hoverLabel}
        </text>
      ) : null}
      {geom.now ? (
        <g className="now-tag" style={{ opacity: showPrice ? 1 : 0 }}>
          <line
            className="now-line"
            x1={geom.left}
            y1={geom.now.y}
            x2={geom.left + geom.innerW}
            y2={geom.now.y}
            stroke="#f4b000"
            strokeWidth={1.2}
            strokeDasharray="4 3"
          />
          <circle
            cx={geom.now.x}
            cy={geom.now.y}
            r={3.5}
            fill="#f4b000"
            stroke="#ffffff"
            strokeWidth={1.4}
          />
          <rect
            x={geom.left + geom.innerW - 82}
            y={geom.now.tagY - 9}
            width={76}
            height={18}
            rx={4}
            fill="#f4b000"
          />
          <text
            x={geom.left + geom.innerW - 76}
            y={geom.now.tagY + 4}
            fontSize={11}
            fontWeight={600}
          >
            {geom.now.label}
          </text>
        </g>
      ) : null}
      {geom.marks.map((mark) => (
        <g className="trade-mark" key={`${mark.side}-${mark.date}`}>
          <circle
            cx={mark.x}
            cy={mark.y}
            r="6.5"
            stroke="#ffffff"
            strokeWidth="1.5"
            style={{ fill: mark.side === "buy" ? BUY : SELL }}
          />
          <text
            x={mark.x}
            y={mark.y + 3}
            textAnchor="middle"
            fontSize="8.5"
            fontWeight="700"
            fill="#ffffff"
            style={{ pointerEvents: "none" }}
          >
            {mark.side === "buy" ? "B" : "S"}
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
  indexTip,
  rangePoints,
  mark,
  pe,
}: {
  name: string;
  code: string;
  rows: IndexClosePoint[];
  index: number;
  digits: number;
  indexTip: boolean;
  rangePoints: IndexClosePoint[];
  mark?: { side: "buy" | "sell"; price: number; note: BuyPointNote | null };
  pe: PeHoverStats | null;
}) {
  const point = rows[index];
  if (!point) return null;
  let peak = 0;
  let peakDate = point.tradeDate;
  for (const historical of rangePoints) {
    if (historical.close > peak) {
      peak = historical.close;
      peakDate = historical.tradeDate;
    }
  }
  // 缩放和平移只改变可见点，不改变所选时间范围的收益基准。
  const base = rangePoints[0]?.close ?? point.close;
  const cumulative = base === 0 ? 0 : (point.close / base - 1) * 100;
  const fromPeak = peak > 0 ? (point.close / peak - 1) * 100 : 0;
  const cumulativeStart = rangePoints[0]?.tradeDate ?? point.tradeDate;
  const cumulativeLabel = `自${cumulativeStart}以来累计涨跌`;
  const summary = (
    <>
      <div>
        <em>收盘价{indexTip ? ":" : ""}</em>
        {fmtClose(point.close, digits)}
      </div>
      <div>
        <em>{cumulativeLabel}{indexTip ? ":" : ""}</em>
        <Pct value={cumulative} />
      </div>
      <div>
        <em>距离最高点（{peakDate}）{indexTip ? ":" : ""}</em>
        <Pct value={fromPeak} />
      </div>
    </>
  );
  return (
    <>
      {indexTip ? (
        <div className="tip-group">
          <i className="tip-dot title" />
          <div>
            <div className="tip-title">
              <b>{name}</b> <span className="tip-code">({code})</span>
            </div>
            <div className="tip-date">{point.tradeDate}</div>
          </div>
        </div>
      ) : (
        <>
          <div className="tip-title">
            <i className="tip-dot" />
            <b>
              {name} ({code})
            </b>
          </div>
          <div className="tip-date">{point.tradeDate}</div>
        </>
      )}
      {indexTip ? (
        <div className="tip-group tip-summary">
          <i className="tip-dot price" />
          <div>{summary}</div>
        </div>
      ) : summary}
      {mark ? (
        <div
          className={mark.side === "buy" ? "tip-trade buy" : "tip-trade sell"}
        >
          <em>{mark.side === "buy" ? "买入 B" : "卖出 S"}</em>
          {fmtClose(mark.price, digits)}
        </div>
      ) : null}
      {mark?.note ? <BuyNote note={mark.note} /> : null}
      {pe ? <PeNote stats={pe} /> : null}
    </>
  );
}

function SeriesLegend({
  priceOn,
  peOn,
  onToggle,
}: {
  priceOn: boolean;
  peOn: boolean;
  onToggle: (key: "price" | "pe") => void;
}) {
  return (
    <div className="series-legend" role="group" aria-label="折线">
      <button
        type="button"
        aria-pressed={priceOn}
        className={priceOn ? undefined : "off"}
        onClick={() => onToggle("price")}
      >
        <i className="swatch price" />
        点位
      </button>
      <button
        type="button"
        aria-pressed={peOn}
        className={peOn ? undefined : "off"}
        onClick={() => onToggle("pe")}
      >
        <i className="swatch pe" />
        市盈率
      </button>
    </div>
  );
}

function PeNote({ stats }: { stats: PeHoverStats }) {
  return (
    <div className="tip-pe">
      <div className="tip-pe-group">
        <i className="dot gold" />
        <div>
          <div>
            <b>市盈率:</b> {stats.peTtm.toFixed(2)}
          </div>
          <div className="sub">历史分位: {stats.historyRank.toFixed(2)}%</div>
          <div className="sub">五年分位: {stats.fiveYearRank.toFixed(2)}%</div>
          <div className="sub">十年分位: {stats.tenYearRank.toFixed(2)}%</div>
        </div>
      </div>
      <div className="tip-pe-group">
        <i className="dot pink" />
        <div>
          <div>
            <b>市盈五年均值:</b> {stats.fiveYearMean.toFixed(2)}
          </div>
          <div className="sub">
            现值偏离: <Pct value={stats.fiveYearGap} />
          </div>
        </div>
      </div>
      <div className="tip-pe-group">
        <i className="dot brown" />
        <div>
          <div>
            <b>市盈十年均值:</b> {stats.tenYearMean.toFixed(2)}
          </div>
          <div className="sub">
            现值偏离: <Pct value={stats.tenYearGap} />
          </div>
        </div>
      </div>
    </div>
  );
}

/** 右轴市盈率。缺值的日子断开，避免把空档连成斜线。 */
function peOverlay(
  rows: IndexClosePoint[],
  xAt: (index: number) => number,
  top: number,
  innerH: number,
): { line: string; ticks: GeomTick[] } {
  const values = rows.flatMap((row) => (row.peTtm == null ? [] : [row.peTtm]));
  if (values.length === 0) return { line: "", ticks: [] };
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = Math.max((max - min) * 0.08, 0.4);
  const y0 = Math.max(0, min - pad);
  const y1 = max + pad;
  const yAt = (value: number) =>
    top + (1 - (value - y0) / (y1 - y0 || 1)) * innerH;
  let line = "";
  let drawing = false;
  rows.forEach((row, index) => {
    if (row.peTtm == null) {
      drawing = false;
      return;
    }
    line += `${drawing ? "L" : "M"}${xAt(index).toFixed(2)} ${yAt(row.peTtm).toFixed(2)} `;
    drawing = true;
  });
  const ticks = ticksOf(y0, y1).map((value) => ({
    value,
    y: yAt(value),
    label: peTickLabel(value),
  }));
  return { line: line.trim(), ticks };
}

function peTickLabel(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function BuyNote({ note }: { note: BuyPointNote }) {
  return (
    <div className="tip-buy-note">
      <span>
        <small>市盈率（PE-TTM）</small>
        <strong>{note.peTtm.toFixed(2)} 倍</strong>
      </span>
      <span>
        <small>距上一买点</small>
        <strong>{note.gapLabel}</strong>
      </span>
    </div>
  );
}

function Pct({ value }: { value: number }) {
  const kind = value < -0.005 ? "down" : value > 0.005 ? "up" : "flat";
  return (
    <span
      className={kind}
    >{`${value > 0 ? "+" : ""}${value.toFixed(2)}%`}</span>
  );
}

type GeomTick = { value: number; y: number; label: string };

function buildGeom(
  rows: IndexClosePoint[],
  code: string,
  marks: EtfTradeMark[],
  size: { width: number; height: number },
  options: {
    fromZero: boolean;
    extras: number[];
    digits: number;
    level: number | null;
    showNow: boolean;
  },
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
    line: "",
    area: "",
    peLine: "",
    peTicks: [] as GeomTick[],
    levelY: null,
    now: null,
    marks: [],
  };
  if (size.width < 40 || size.height < 40 || rows.length === 0) return empty;

  const hasPe = rows.some((row) => row.peTtm != null);
  const left = options.digits > 2 ? 48 : 52;
  // 右轴留白只看数据有没有市盈率：开关图例不改变绘图区宽度，杜绝整图横向跳位。
  const right = hasPe ? 56 : PLOT_RIGHT;
  const top = PLOT_TOP;
  const bottom = PLOT_BOTTOM;
  const innerW = size.width - left - right;
  const innerH = size.height - top - bottom;
  const [y0, y1] = plotDomain(rows, code, options.fromZero, options.extras);
  const t0 = Date.parse(rows[0].tradeDate);
  const t1 = Date.parse(rows[rows.length - 1].tradeDate);
  const xAt = (index: number) =>
    left + ((Date.parse(rows[index].tradeDate) - t0) / (t1 - t0 || 1)) * innerW;
  const yAt = (value: number) =>
    top + (1 - (value - y0) / (y1 - y0 || 1)) * innerH;

  const ticks = ticksOf(y0, y1).map((value) => ({
    value,
    y: yAt(value),
    label: axisLabel(value, code, rows, options.digits, options.fromZero, y1),
  }));
  const years: Array<{ x: number; year: string }> = [];
  let lastX = -999;
  let lastYear = "";
  rows.forEach((row, index) => {
    const year = row.tradeDate.slice(0, 4);
    if (year === lastYear) return;
    const x = xAt(index);
    // 年初挤在上一年旁边时，继续往后找，直到留出 46px 再落字。
    if (index !== 0 && x - lastX < 46 && index !== rows.length - 1) return;
    lastYear = year;
    lastX = x;
    years.push({ x, year });
  });

  const xs: number[] = [];
  const ys: number[] = [];
  let line = "";
  rows.forEach((row, index) => {
    const x = xAt(index);
    const y = yAt(row.close);
    xs.push(x);
    ys.push(y);
    line += `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)} `;
  });
  const baseY = (top + innerH).toFixed(2);
  const area = `${line.trim()} L${(xs[xs.length - 1] ?? left).toFixed(2)} ${baseY} L${(xs[0] ?? left).toFixed(2)} ${baseY} Z`;

  const placed = snapTrades(rows, marks);
  const places: Geom["marks"] = [];
  placed.forEach((mark, date) => {
    const index = rows.findIndex((row) => row.tradeDate === date);
    if (index < 0) return;
    places.push({
      x: xAt(index),
      y: yAt(rows[index].close),
      side: mark.side,
      price: mark.price,
      date,
      index,
      note: buyPointNote(marks, mark.tradeDate),
    });
  });

  const levelY = options.level == null ? null : yAt(options.level);
  // 市盈率几何始终计算（有数据时），图例开关只影响渲染层 opacity。
  const pe = peOverlay(rows, xAt, top, innerH);
  const lastRow = rows[rows.length - 1];
  const nowY = yAt(lastRow.close);
  const now = options.showNow
    ? {
        x: xAt(rows.length - 1),
        y: nowY,
        tagY: Math.max(top + 10, Math.min(top + innerH - 10, nowY)),
        label: lastRow.close.toLocaleString("zh-CN", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }),
      }
    : null;
  return {
    width: size.width,
    height: size.height,
    left,
    top,
    innerW,
    innerH,
    xs,
    ys,
    ticks,
    years,
    line,
    area,
    peLine: pe.line,
    peTicks: pe.ticks,
    levelY,
    now,
    marks: places,
  };
}

/** 纵轴。有记录以来从 0 起；其余时间贴着可见价格。美元兑人民币仍从 6 起。 */
function plotDomain(
  rows: IndexClosePoint[],
  code: string,
  fromZero: boolean,
  extras: number[],
): [number, number] {
  if (code === "USDCNH.OTH") return domainOf(rows, code);
  const values = [...rows.map((row) => row.close), ...extras];
  const max = Math.max(...values);
  const min = Math.min(...values);
  if (fromZero) return [0, axisTop(max)];
  const pad = Math.max((max - min) * 0.1, max * 0.02);
  return [Math.max(0, min - pad), max + pad];
}

/** 刻度文字。指数用整数，价格用两位小数；从 0 起且上沿过 3000 时用 K。 */
function axisLabel(
  value: number,
  code: string,
  rows: IndexClosePoint[],
  digits: number,
  fromZero: boolean,
  max: number,
): string {
  if (code === "USDCNH.OTH") return labelOf(value, code, rows);
  if (digits > 2) return value.toFixed(2);
  if (fromZero && max >= 3000) return labelOf(value, code, rows);
  return Math.round(value).toLocaleString("zh-CN");
}

function isIndexLike(code: string, rows: IndexClosePoint[]): boolean {
  if (code.includes(".OTH")) return true;
  const peak = rows.reduce((max, row) => Math.max(max, row.close), 0);
  return peak >= 100;
}

/** 纵轴范围。美元兑人民币从 6 起，避免汇率被压在从 0 起的指数轴顶端。 */
export function domainOf(
  rows: IndexClosePoint[],
  code: string,
): [number, number] {
  const max = rows.reduce((peak, row) => Math.max(peak, row.close), 0);
  if (code === "USDCNH.OTH") return [6, Math.max(axisTop(max), 7)];
  if (isIndexLike(code, rows)) return [0, axisTop(max)];
  const min = rows.reduce((floor, row) => Math.min(floor, row.close), max);
  const pad = Math.max((max - min) * 0.08, max * 0.01);
  return [Math.max(0, min - pad), max + pad];
}

function axisTop(max: number): number {
  const rough = Math.max(max / 4, 1);
  const mag = 10 ** Math.floor(Math.log10(rough));
  const err = rough / mag;
  const step =
    (err <= 1 ? 1 : err <= 2 ? 2 : err <= 2.5 ? 2.5 : err <= 5 ? 5 : 10) * mag;
  return Math.max(step, Math.ceil(max / step) * step);
}

function ticksOf(min: number, max: number): number[] {
  const rough = (max - min) / 4;
  const mag = 10 ** Math.floor(Math.log10(Math.max(rough, 1e-6)));
  const err = rough / mag;
  const step =
    (err <= 1 ? 1 : err <= 2 ? 2 : err <= 2.5 ? 2.5 : err <= 5 ? 5 : 10) * mag;
  const start = Math.ceil((min - 1e-9) / step) * step;
  const ticks: number[] = [];
  for (let value = start; value <= max + step * 0.001; value += step)
    ticks.push(Number(value.toFixed(6)));
  return ticks;
}

/** 纵轴刻度文字。汇率保留两位小数，指数仍取整。 */
export function labelOf(
  value: number,
  code: string,
  rows: IndexClosePoint[],
): string {
  if (code === "USDCNH.OTH" || !isIndexLike(code, rows))
    return value.toFixed(2);
  if (value === 0) return "0";
  if (value >= 1000 && value % 1000 === 0) return `${value / 1000}K`;
  if (value >= 1000) return `${(value / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(Math.round(value));
}

function snapTrades(
  rows: IndexClosePoint[],
  marks: EtfTradeMark[],
): Map<string, EtfTradeMark> {
  const dates = rows.map((row) => row.tradeDate);
  const placed = new Map<string, EtfTradeMark>();
  const pending: EtfTradeMark[] = [];
  marks.forEach((mark) => {
    if (dates.includes(mark.tradeDate)) placed.set(mark.tradeDate, mark);
    else pending.push(mark);
  });
  pending.forEach((mark) => {
    const target = Date.parse(`${mark.tradeDate}T00:00:00Z`);
    let best: string | null = null;
    let gap = 5;
    dates.forEach((date) => {
      if (placed.has(date)) return;
      const days =
        Math.abs(Date.parse(`${date}T00:00:00Z`) - target) / 86400000;
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
  return value.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function slashDate(value: string): string {
  return value.replaceAll("-", "/");
}
