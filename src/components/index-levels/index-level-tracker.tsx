"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { EssayRail } from "@/components/index-levels/index-essay-rail";
import { IndexLevelChart, SpanTabs } from "@/components/index-levels/index-level-chart";
import { attachIndexPe, csindexSymbol, isValidPeTtm, type PePoint } from "@/lib/index-levels/pe-series";
import { HelpTooltip } from "@/components/shared/help-tooltip";
import { IndexLevelPicker } from "@/components/index-levels/index-level-picker";
import {
  INDEX_WATCHES,
  quoteHref,
  quoteSource,
  resolveWatchedIndex,
  type IndexLevelMark,
  type IndexQuote,
  type IndexWatch,
} from "@/lib/index-levels/catalog";
import { A500_ETF_TRADES } from "@/lib/index-levels/a500-etf-trades";
import { A500_LINK_TRADES } from "@/lib/index-levels/a500-link-trades";
import { essaysForIndex } from "@/lib/index-levels/index-essays";
import {
  isJournalLinkedEtf,
  resolveEtfChartMarks,
} from "@/lib/index-levels/etf-journal-marks";
import { MEDICAL_LINK_TRADES } from "@/lib/index-levels/medical-link-trades";
import { useEtfJournalMarks } from "@/hooks/use-etf-journal-marks";
import {
  MEDIA_ETF_TRADES,
  type EtfTradeMark,
} from "@/lib/index-levels/media-etf-trades";
import { MEDIA_LINK_TRADES } from "@/lib/index-levels/media-link-trades";
import { SECURITIES_ETF_TRADES } from "@/lib/index-levels/securities-etf-trades";
import { SECURITIES_LINK_TRADES } from "@/lib/index-levels/securities-link-trades";
import type {
  CloseSpan,
  IndexClosePoint,
} from "@/lib/index-levels/close-series";
import type { CmbUsdQuotes } from "@/lib/index-levels/cmb-fx";
import { CMB_USD_BUY_MARKS } from "@/lib/index-levels/cmb-fx-trades";
import {
  changePct,
  classifyChange,
  formatClose,
  formatMarkLabel,
} from "@/lib/index-levels/position";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { fetchEtfCloseSeries } from "@/lib/supabase/etf-daily-repository";
import { loadChartFundNav } from "@/lib/supabase/fund-nav-repository";
import {
  fetchIndexCloseSeries,
  type IndexLatestClose,
} from "@/lib/supabase/index-daily-repository";

type Phase = "loading" | "ready" | "error";

const INDEX_QUERY = "index";

/** 至少两根相邻交易日有有效 PE，图上才会出现一段市盈率折线。 */
function hasPeLine(points: IndexClosePoint[]): boolean {
  return points.some((point, index) =>
    index > 0 &&
    isValidPeTtm(point.peTtm) &&
    isValidPeTtm(points[index - 1]?.peTtm),
  );
}

function useWatchedIndex(): [string, (next: string) => void] {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const code = resolveWatchedIndex(searchParams.get(INDEX_QUERY));

  useEffect(() => {
    if (searchParams.get(INDEX_QUERY) === code) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set(INDEX_QUERY, code);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [code, pathname, router, searchParams]);

  const select = (next: string): void => {
    const params = new URLSearchParams(searchParams.toString());
    params.set(INDEX_QUERY, resolveWatchedIndex(next));
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return [code, select];
}

/**
 * key 变化的那次渲染先同步执行 reset，再交给 effect 重拉。
 * 避免 effect 生效前的提交帧把旧 key 的数据画进新 key 的界面。
 */
function useResetOnChange(key: unknown, reset: () => void): void {
  const [loaded, setLoaded] = useState(key);
  if (loaded !== key) {
    setLoaded(key);
    reset();
  }
}

/**
 * 加载期的两连闪治理：新数据未到（value 为 null）时沿用上一份非空值，
 * 到达后由调用方用 key 重挂触发 0.4→1 微闪（不做滚动计数，金融忌误导读数）。
 * scope 限定沿用范围：换指数（scope 变化）时立即清空旧值，
 * 避免旧指数的收盘价/涨跌被冠到新指数名下（跨数据源的读数串台）。
 */
function useStaleWhileLoading<T>(value: T | null, scope: unknown): T | null {
  const [state, setState] = useState<{ scope: unknown; kept: T | null }>({
    scope,
    kept: value,
  });
  if (scope !== state.scope) {
    setState({ scope, kept: value });
    return value;
  }
  if (value != null && value !== state.kept) {
    setState({ scope, kept: value });
  }
  return value ?? state.kept;
}

/** 指数与场内 ETF 的收盘序列。 */
function useCloseSeries(
  code: string,
  etfCode?: string,
): {
  points: IndexClosePoint[];
  etfPoints: IndexClosePoint[];
  phase: Phase;
  etfPhase: Phase;
  reload: () => void;
} {
  const [points, setPoints] = useState<IndexClosePoint[]>([]);
  const [etfPoints, setEtfPoints] = useState<IndexClosePoint[]>([]);
  const [phase, setPhase] = useState<Phase>("loading");
  const [etfPhase, setEtfPhase] = useState<Phase>(etfCode ? "loading" : "ready");
  // 出错态「重新加载」按钮：递增 token 重跑同一个拉取 effect。
  const [retry, setRetry] = useState(0);

  useResetOnChange(code, () => {
    setPoints([]);
    setEtfPoints([]);
    setPhase("loading");
    setEtfPhase(etfCode ? "loading" : "ready");
  });

  useEffect(() => {
    if (!code) return undefined;
    let cancelled = false;
    setPhase("loading");
    setPoints([]);
    setEtfPoints([]);
    setEtfPhase(etfCode ? "loading" : "ready");
    const client = createBrowserSupabaseClient();
    fetchIndexCloseSeries(client, code)
      .then(async (series) => {
        if (cancelled) return;
        if (series.length === 0) throw new Error("指数收盘数据为空");
        // 页头可先展示收盘；图表继续等市盈率，不呈现只有点位的过渡帧。
        setPoints(series);
        const withPe = await attachIndexPe(code, series);
        if (cancelled) return;
        if (csindexSymbol(code) && !hasPeLine(withPe)) {
          throw new Error("指数市盈率折线数据不足");
        }
        setPoints(withPe);
        setPhase("ready");
      })
      .catch(() => {
        if (!cancelled) setPhase("error");
      });
    if (etfCode) {
      fetchEtfCloseSeries(client, etfCode)
        .then((series) => {
          if (cancelled) return;
          setEtfPoints(series);
          setEtfPhase("ready");
        })
        .catch(() => {
          if (!cancelled) setEtfPhase("error");
        });
    }
    return () => {
      cancelled = true;
    };
  }, [code, etfCode, retry]);

  const reload = useCallback(() => setRetry((count) => count + 1), []);
  return { points, etfPoints, phase, etfPhase, reload };
}

/** 场外基金单位净值。已列入共享表的代码优先读落库序列，没有行时走 fund-nav 接口。 */
function useFundSeries(fundCode?: string): {
  fundPoints: IndexClosePoint[];
  fundPhase: Phase;
  reload: () => void;
} {
  const [fundPoints, setFundPoints] = useState<IndexClosePoint[]>([]);
  const [fundPhase, setFundPhase] = useState<Phase>("ready");
  // 出错态「重新加载」按钮：递增 token 重跑拉取。
  const [retry, setRetry] = useState(0);

  useResetOnChange(fundCode, () => {
    setFundPoints([]);
    setFundPhase(fundCode ? "loading" : "ready");
  });

  useEffect(() => {
    let cancelled = false;
    setFundPoints([]);
    if (!fundCode) {
      setFundPhase("ready");
      return undefined;
    }
    setFundPhase("loading");
    loadChartFundNav(fundCode)
      .then((points) => {
        if (!cancelled) {
          setFundPoints(points);
          setFundPhase("ready");
        }
      })
      .catch(() => {
        if (!cancelled) setFundPhase("error");
      });
    return () => {
      cancelled = true;
    };
  }, [fundCode, retry]);

  const reload = useCallback(() => setRetry((count) => count + 1), []);
  return { fundPoints, fundPhase, reload };
}

/**
 * 点位跟踪：页头是指数名和日期，主图给出收盘、时间范围和可选点位，
 * 原文跟在点位下面。关联基金与招行汇率沿用同一套折线。
 * 当前指数写在 query `index` 上。
 */
export function IndexLevelTracker() {
  const [code, setCode] = useWatchedIndex();
  const current =
    INDEX_WATCHES.find((item) => item.code === code) ?? INDEX_WATCHES[0];
  const { points, etfPoints, phase, etfPhase, reload: reloadClose } =
    useCloseSeries(code, current?.chartEtf?.code);
  const chartEtfCode = current?.chartEtf?.code;
  const journalMarks = useEtfJournalMarks(
    isJournalLinkedEtf(chartEtfCode) ? chartEtfCode : undefined,
  );
  const { fundPoints, fundPhase, reload: reloadFund } = useFundSeries(
    current?.chartFund?.code,
  );
  const cmb = useCmbFxSeries(current?.chartBankFx === true);
  // 记住用户最后主动选择的时间范围（系统能记住的不让重设）
  const [span, setSpanState] = useState<CloseSpan>("5");
  const setSpan = (next: CloseSpan) => {
    setSpanState(next);
    try {
      window.localStorage.setItem("index-levels:span", next);
    } catch {
      /* 隐私模式等存储不可用时静默降级 */
    }
  };
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("index-levels:span");
      if (saved && SPANS.some(item => item.id === saved)) {
        setSpanState(saved as CloseSpan);
      }
    } catch {
      /* 同上 */
    }
  }, []);
  const [levelId, setLevelId] = useState<string | null>(
    defaultLevelId(current?.levels ?? []),
  );
  const [essayOpen, setEssayOpen] = useState(false);
  const closeEssays = useCallback(() => {
    setEssayOpen(false);
    document.getElementById("essay-open")?.focus();
  }, []);

  useResetOnChange(code, () => {
    setLevelId(defaultLevelId(current?.levels ?? []));
    setEssayOpen(false);
  });

  const close = useMemo(
    () => latestClose(code, points),
    [code, points],
  );
  // 状态变化：同一指数刷新期间页头读数保持旧值（不回退成「—」），新值到达后微闪一次；
  // 换指数时以 code 为作用域立即清空，新数据到位前显示「—」，杜绝旧读数串台。
  const shownClose = useStaleWhileLoading(close, code);
  const windowed = useMemo(() => sliceSpan(points, span), [points, span]);
  const etfWindow = useMemo(
    () => sliceSpan(etfPoints, span, windowed[windowed.length - 1]?.tradeDate),
    [etfPoints, span, windowed],
  );
  const fundWindow = useMemo(
    () => sliceSpan(fundPoints, span, windowed[windowed.length - 1]?.tradeDate),
    [fundPoints, span, windowed],
  );
  const levelPoints = useMemo(
    () => (current?.levels ?? []).map((level) => level.point),
    [current],
  );
  const peHistory = useMemo<PePoint[]>(
    () =>
      points.flatMap((point) =>
        point.peTtm == null
          ? []
          : [{ tradeDate: point.tradeDate, peTtm: point.peTtm }],
      ),
    [points],
  );
  const indexChartPhase = phase === "ready" && csindexSymbol(code) &&
    !hasPeLine(windowed)
    ? "error"
    : phase;

  if (!current) return null;
  const selected =
    current.levels.find((level) => String(level.point) === levelId) ?? null;
  // 区间对照同样消费「旧值保持」的读数，与页头一致。
  const edge = shownClose
    ? brackets(shownClose.close, current.levels)
    : { below: null, above: null };
  const quotes = selected
    ? quotesForLevel(current.quotes, selected, current.levels)
    : [];
  const chooseLevel = (id: string) =>
    setLevelId((currentId) => (currentId === id ? null : id));
  const essays = essaysForIndex(current.code);
  const main = (
    <>
      <section className="panel">
        <TrackerHead
          current={current}
          date={shownClose?.tradeDate}
          essayCount={essays.length}
          onOpenEssays={() => setEssayOpen(true)}
          onSelect={setCode}
        />
        <div className="group-head">
          <div className="readout">
            {/* key 随新读数变化重挂一次，播放 0.4→1 的「新值到达」微闪 */}
            <div
              className="quote quote-fresh"
              key={`${shownClose?.indexCode ?? "none"}-${shownClose?.tradeDate ?? ""}-${shownClose?.close ?? ""}`}
            >
              <div className="px-row">
                <b className="px">{shownClose ? formatClose(shownClose.close) : "—"}</b>
                <ChangeText close={shownClose} />
              </div>
              <GapText below={edge.below} above={edge.above} />
            </div>
            <div className="time-side">
              <SpanTabs span={span} onChange={setSpan} />
            </div>
          </div>
        </div>
        <IndexLevelChart
          bare
          presliced
          axisFromZero
          name={current.name}
          code={current.code}
          points={windowed}
          phase={indexChartPhase}
          errorLabel={csindexSymbol(code) ? "点位或市盈率暂时无法读取" : "收盘数据暂时无法读取"}
          onRetry={reloadClose}
          span={span}
          levels={levelPoints}
          peHistory={peHistory}
          activeLevel={selected?.point ?? null}
          onActiveLevel={
            selected ? () => chooseLevel(String(selected.point)) : undefined
          }
        />
        {current.levels.length > 0 ? (
          <div className="level-picker" role="group" aria-label="关键点位">
            {current.levels.map((level) => (
              <button
                key={level.point}
                type="button"
                data-level={level.point}
                aria-pressed={selected?.point === level.point}
                onClick={() => chooseLevel(String(level.point))}
              >
                <span>{level.name}</span>
                <b>{formatMarkLabel(level.label)}</b>
              </button>
            ))}
          </div>
        ) : null}
        {/* 折叠槽常挂载：取消档位选择时 0fr→1fr 收起，下方内容不瞬跳 */}
        <div className="level-sheet-wrap" data-open={quotes.length > 0 ? "true" : "false"}>
          <QuoteSheet quotes={quotes} />
        </div>
      </section>

      <CmbFxCharts
        enabled={current.chartBankFx === true}
        quotes={cmb}
        span={span}
        end={windowed[windowed.length - 1]?.tradeDate}
      />

      <LinkedFundCharts
        watch={current}
        etfPoints={etfWindow}
        fundPoints={fundWindow}
        phase={etfPhase}
        fundPhase={fundPhase}
        reloadEtf={reloadClose}
        reloadFund={reloadFund}
        span={span}
        etfMarks={resolveEtfChartMarks(
          current.chartEtf?.code,
          journalMarks,
          ETF_TRADE_MARKS[current.chartEtf?.code ?? ""] ?? [],
        )}
      />
    </>
  );

  return (
    <>
      {main}
      <EssayRail essays={essays} open={essayOpen} onClose={closeEssays} />
    </>
  );
}

/** 招行美元汇买、汇卖。未配置时不请求。 */
function useCmbFxSeries(enabled: boolean): {
  points: CmbUsdQuotes;
  phase: Phase;
  reload: () => void;
} {
  const [points, setPoints] = useState<CmbUsdQuotes>({ bid: [], ask: [] });
  const [phase, setPhase] = useState<Phase>(enabled ? "loading" : "ready");
  // 出错态「重新加载」按钮：递增 token 重跑拉取。
  const [retry, setRetry] = useState(0);

  useResetOnChange(enabled, () => {
    setPoints({ bid: [], ask: [] });
    setPhase(enabled ? "loading" : "ready");
  });

  useEffect(() => {
    let cancelled = false;
    setPoints({ bid: [], ask: [] });
    if (!enabled) {
      setPhase("ready");
      return undefined;
    }
    setPhase("loading");
    fetch("/api/index-levels/cmb-fx")
      .then((response) => {
        if (!response.ok) throw new Error("cmb fx failed");
        return response.json() as Promise<Partial<CmbUsdQuotes>>;
      })
      .then((body) => {
        if (cancelled) return;
        setPoints({ bid: body.bid ?? [], ask: body.ask ?? [] });
        setPhase("ready");
      })
      .catch(() => {
        if (!cancelled) setPhase("error");
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, retry]);

  const reload = useCallback(() => setRetry((count) => count + 1), []);
  return { points, phase, reload };
}

const CMB_ASK_HELP =
  "在招行买入美元（购汇）的成交价，即银行卖出价。按 1 美元计。";
const CMB_BID_HELP =
  "把美元卖给招行（结汇）的成交价，即银行买入价。按 1 美元计。";

/**
 * 招行汇卖、汇买一行两列。购汇用的汇卖在左。窄屏与传媒 ETF 行同一断点折回单列。
 */
function CmbFxCharts({
  enabled,
  quotes,
  span,
  end,
}: {
  enabled: boolean;
  quotes: { points: CmbUsdQuotes; phase: Phase; reload: () => void };
  span: CloseSpan;
  end?: string;
}) {
  if (!enabled) return null;
  const ask = sliceSpan(quotes.points.ask, span, end);
  const bid = sliceSpan(quotes.points.bid, span, end);
  return (
    <section className="fund-block" aria-label="招行美元汇卖与汇买">
      <div className="fund-grid">
        <article className="fund-panel">
          <h3 className="fund-title">
            招行汇卖 <span className="code">USD.ASK</span>
            <span className="title-help">
              <HelpTooltip title={CMB_ASK_HELP} />
            </span>
          </h3>
          <IndexLevelChart
            bare
            presliced
            name="招行汇卖"
            code="USD.ASK"
            points={ask}
            phase={quotes.phase}
            onRetry={quotes.reload}
            span={span}
            priceDigits={5}
            marks={CMB_USD_BUY_MARKS}
          />
        </article>
        <article className="fund-panel">
          <h3 className="fund-title">
            招行汇买 <span className="code">USD.BID</span>
            <span className="title-help">
              <HelpTooltip title={CMB_BID_HELP} />
            </span>
          </h3>
          <IndexLevelChart
            bare
            presliced
            name="招行汇买"
            code="USD.BID"
            points={bid}
            phase={quotes.phase}
            onRetry={quotes.reload}
            span={span}
            priceDigits={4}
          />
        </article>
      </div>
    </section>
  );
}

/** 页头：指数名在左，日期在名字下面，跟踪指数在右。 */
function TrackerHead({
  current,
  date,
  essayCount,
  onOpenEssays,
  onSelect,
}: {
  current: IndexWatch;
  date?: string;
  essayCount: number;
  onOpenEssays: () => void;
  onSelect: (next: string) => void;
}) {
  return (
    <header className="head">
      <div className="title-block">
        <h1>
          {current.name} <span className="code">{current.code}</span>
        </h1>
        <time className="page-date" dateTime={date}>
          {date ? date.replaceAll("-", "/") : "—"}
        </time>
      </div>
      <div className="head-actions">
        {essayCount > 0 ? (
          <button
            type="button"
            className="essay-open"
            id="essay-open"
            onClick={onOpenEssays}
          >
            E大怎么说 <b>{essayCount}</b>
          </button>
        ) : null}
        <label className="selector">
          <span className="selector-label">跟踪指数</span>
          <IndexLevelPicker value={current.code} onChange={onSelect} />
        </label>
      </div>
    </header>
  );
}

const ETF_TRADE_MARKS: Record<string, EtfTradeMark[]> = {
  "512980": MEDIA_ETF_TRADES,
  "512880": SECURITIES_ETF_TRADES,
  "563360": A500_ETF_TRADES,
};

const FUND_TRADE_MARKS: Record<string, EtfTradeMark[]> = {
  "004752": MEDIA_LINK_TRADES,
  "502010": SECURITIES_LINK_TRADES,
  "022424": A500_LINK_TRADES,
  "162412": MEDICAL_LINK_TRADES,
};

/**
 * 关联标的折线：场内 ETF 与场外基金两张齐全时一行两列并排，
 * 只配置其中一张时维持整行宽版。
 */
function LinkedFundCharts({
  watch,
  etfPoints,
  fundPoints,
  phase,
  fundPhase,
  reloadEtf,
  reloadFund,
  span,
  etfMarks,
}: {
  watch: IndexWatch;
  etfPoints: IndexClosePoint[];
  fundPoints: IndexClosePoint[];
  phase: Phase;
  fundPhase: Phase;
  reloadEtf: () => void;
  reloadFund: () => void;
  span: CloseSpan;
  etfMarks: EtfTradeMark[];
}) {
  const etf = watch.chartEtf ? (
    <article className="fund-panel" key={watch.chartEtf.code}>
      <h3 className="fund-title">
        {watch.chartEtf.name}{" "}
        <span className="code">{watch.chartEtf.code}</span>
      </h3>
      <IndexLevelChart
        bare
        presliced
        name={watch.chartEtf.name}
        code={watch.chartEtf.code}
        points={etfPoints}
        phase={phase}
        onRetry={reloadEtf}
        span={span}
        marks={etfMarks}
        priceDigits={3}
      />
    </article>
  ) : null;
  const fund = watch.chartFund ? (
    <article className="fund-panel" key={watch.chartFund.code}>
      <h3 className="fund-title">
        {watch.chartFund.href ? (
          <a href={watch.chartFund.href} target="_blank" rel="noreferrer">
            {watch.chartFund.name}
          </a>
        ) : (
          watch.chartFund.name
        )}
        <span className="code">{watch.chartFund.code}</span>
      </h3>
      <IndexLevelChart
        bare
        presliced
        name={watch.chartFund.name}
        code={watch.chartFund.code}
        points={fundPoints}
        phase={fundPhase}
        onRetry={reloadFund}
        span={span}
        marks={FUND_TRADE_MARKS[watch.chartFund.code] ?? []}
        priceDigits={4}
      />
    </article>
  ) : null;
  if (!etf && !fund) return null;
  return (
    <section className="fund-block">
      <div className="group-head">
        <div className="group-title">
          <h2>跟踪基金</h2>
        </div>
      </div>
      <div className={etf && fund ? "fund-grid" : "fund-grid is-single"}>
        {etf}
        {fund}
      </div>
    </section>
  );
}

function QuoteSheet({ quotes }: { quotes: IndexQuote[] }) {
  // key 随贴文集合变化：换对照档时新内容淡入一次（旧内容已被折叠槽收起）。
  const contentKey = quotes.map((quote) => quote.postId).join("-");
  return (
    <section className="level-sheet" aria-live="polite" aria-label="E大贴文">
      <div className="level-sheet-inner" key={contentKey}>
        {quotes.map((quote) => {
          const href = quoteHref(quote);
          return (
            <article className="utter" key={quote.postId}>
              <time dateTime={quote.date}>{quote.date.replaceAll("-", "/")}</time>
              <p className="words">
                {quote.text}{" "}
                <a href={href} data-source={quoteSource(href)} target="_blank" rel="noreferrer">
                  查看原文
                </a>
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function ChangeText({ close }: { close: IndexLatestClose | null }) {
  if (!close) return <span className="chg">—</span>;
  const change = changePct(close.close, close.previousClose);
  const kind = classifyChange(change);
  const text =
    change == null ? "—" : `${change > 0 ? "+" : ""}${change.toFixed(2)}%`;
  return <span className={`chg ${kind}`}>{text}</span>;
}

function GapText({
  below,
  above,
}: {
  below: IndexLevelMark | null;
  above: IndexLevelMark | null;
}) {
  if (!below || !above) return <span className="gap">—</span>;
  return (
    <span className="gap">
      介于 <b>{`${below.name} ${formatMarkLabel(below.label)}`}</b>
      {" 与 "}
      <b>{`${above.name} ${formatMarkLabel(above.label)}`}</b>
    </span>
  );
}

function defaultLevelId(levels: IndexLevelMark[]): string | null {
  const picked = levels.find((level) => level.name === "压力") ?? levels[0];
  return picked ? String(picked.point) : null;
}

function brackets(
  close: number,
  levels: IndexLevelMark[],
): { below: IndexLevelMark | null; above: IndexLevelMark | null } {
  const sorted = [...levels].sort((a, b) => a.point - b.point);
  return {
    below: [...sorted].reverse().find((level) => level.point <= close) ?? null,
    above: sorted.find((level) => level.point > close) ?? null,
  };
}

/** 原文属于哪一档：点位数字对上，差 10 点以内的近邻（如 1403 → 1400）也算。 */
function quotesForLevel(
  quotes: IndexQuote[],
  level: IndexLevelMark,
  levels: IndexLevelMark[],
): IndexQuote[] {
  return quotes
    .filter((quote) => quoteMentions(quote.level, level, levels))
    .sort((a, b) => a.date.localeCompare(b.date) || a.postId - b.postId);
}

function quoteMentions(
  text: string,
  level: IndexLevelMark,
  levels: IndexLevelMark[],
): boolean {
  if (levels.length === 0) return false;
  const numbers = numbersIn(text);
  if (numbers.some((value) => value === level.point)) return true;
  const exact = levels.some((item) =>
    numbers.some((value) => value === item.point),
  );
  if (exact) return false;
  return numbers.some((value) => {
    const nearest = levels.reduce((best, item) =>
      Math.abs(item.point - value) < Math.abs(best.point - value) ? item : best,
    );
    return nearest.point === level.point && Math.abs(level.point - value) <= 10;
  });
}

function numbersIn(text: string): number[] {
  const found: number[] = [];
  const pattern = /\d+(?:\.\d+)?/g;
  let match = pattern.exec(text);
  while (match) {
    found.push(Number(match[0]));
    match = pattern.exec(text);
  }
  return found;
}

function sliceSpan(
  points: IndexClosePoint[],
  span: CloseSpan,
  endDate?: string,
): IndexClosePoint[] {
  if (span === "all" || points.length === 0) return points;
  const end = endDate || points[points.length - 1].tradeDate;
  const [year, month, day] = end.split("-");
  const cut = `${Number(year) - Number(span)}-${month}-${day}`;
  return points.filter(
    (point) => point.tradeDate >= cut && point.tradeDate <= end,
  );
}

function latestClose(
  code: string,
  points: IndexClosePoint[],
): IndexLatestClose | null {
  const latest = points[points.length - 1];
  if (!latest) return null;
  return {
    indexCode: code,
    tradeDate: latest.tradeDate,
    close: latest.close,
    previousClose: points[points.length - 2]?.close ?? null,
  };
}
