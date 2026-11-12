'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { IndexLevelChart } from '@/components/index-levels/index-level-chart';
import { HelpTooltip } from '@/components/shared/help-tooltip';
import { IndexLevelPicker } from '@/components/index-levels/index-level-picker';
import {
  INDEX_WATCHES,
  quoteHref,
  resolveWatchedIndex,
  type IndexLevelMark,
  type IndexQuote,
  type IndexWatch,
} from '@/lib/index-levels/catalog';
import { MEDIA_ETF_TRADES, type EtfTradeMark } from '@/lib/index-levels/media-etf-trades';
import { MEDIA_LINK_TRADES } from '@/lib/index-levels/media-link-trades';
import { SECURITIES_ETF_TRADES } from '@/lib/index-levels/securities-etf-trades';
import { SECURITIES_LINK_TRADES } from '@/lib/index-levels/securities-link-trades';
import type { CloseSpan, IndexClosePoint } from '@/lib/index-levels/close-series';
import type { CmbUsdQuotes } from '@/lib/index-levels/cmb-fx';
import { CMB_USD_BUY_MARKS } from '@/lib/index-levels/cmb-fx-trades';
import { changePct, classifyChange, formatClose, formatMarkLabel } from '@/lib/index-levels/position';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { fetchEtfCloseSeries } from '@/lib/supabase/etf-daily-repository';
import { loadChartFundNav } from '@/lib/supabase/fund-nav-repository';
import { fetchIndexCloseSeries, type IndexLatestClose } from '@/lib/supabase/index-daily-repository';

type Phase = 'loading' | 'ready' | 'error';

const INDEX_QUERY = 'index';

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

/** 指数与场内 ETF 的收盘序列。 */
function useCloseSeries(code: string, etfCode?: string): {
  points: IndexClosePoint[];
  etfPoints: IndexClosePoint[];
  phase: Phase;
} {
  const [points, setPoints] = useState<IndexClosePoint[]>([]);
  const [etfPoints, setEtfPoints] = useState<IndexClosePoint[]>([]);
  const [phase, setPhase] = useState<Phase>('loading');

  useResetOnChange(code, () => {
    setPoints([]);
    setEtfPoints([]);
    setPhase('loading');
  });

  useEffect(() => {
    if (!code) return undefined;
    let cancelled = false;
    setPhase('loading');
    setPoints([]);
    setEtfPoints([]);
    const client = createBrowserSupabaseClient();
    Promise.all([
      fetchIndexCloseSeries(client, code),
      etfCode ? fetchEtfCloseSeries(client, etfCode) : Promise.resolve(null),
    ])
      .then(([series, etfSeries]) => {
        if (cancelled) return;
        setPoints(series);
        setEtfPoints(etfSeries ?? []);
        setPhase('ready');
      })
      .catch(() => {
        if (!cancelled) setPhase('error');
      });
    return () => {
      cancelled = true;
    };
  }, [code, etfCode]);

  return { points, etfPoints, phase };
}

/** 场外基金单位净值。004752 与 502010 优先读已落库序列，其余走 fund-nav 接口。 */
function useFundSeries(fundCode?: string): { fundPoints: IndexClosePoint[]; fundPhase: Phase } {
  const [fundPoints, setFundPoints] = useState<IndexClosePoint[]>([]);
  const [fundPhase, setFundPhase] = useState<Phase>('ready');

  useResetOnChange(fundCode, () => {
    setFundPoints([]);
    setFundPhase(fundCode ? 'loading' : 'ready');
  });

  useEffect(() => {
    let cancelled = false;
    setFundPoints([]);
    if (!fundCode) {
      setFundPhase('ready');
      return undefined;
    }
    setFundPhase('loading');
    loadChartFundNav(fundCode)
      .then(points => {
        if (!cancelled) {
          setFundPoints(points);
          setFundPhase('ready');
        }
      })
      .catch(() => {
        if (!cancelled) setFundPhase('error');
      });
    return () => {
      cancelled = true;
    };
  }, [fundCode]);

  return { fundPoints, fundPhase };
}

const SPANS: Array<{ id: CloseSpan; label: string }> = [
  { id: 'all', label: '上市以来' },
  { id: '10', label: '近 10 年' },
  { id: '5', label: '近 5 年' },
];

/**
 * 点位跟踪：页头是指数名和日期，主图给出收盘、时间范围和可选点位，
 * 原文跟在点位下面。关联基金与招行汇率沿用同一套折线。
 * 当前指数写在 query `index` 上。
 */
export function IndexLevelTracker() {
  const [code, setCode] = useWatchedIndex();
  const current = INDEX_WATCHES.find(item => item.code === code) ?? INDEX_WATCHES[0];
  const { points, etfPoints, phase } = useCloseSeries(code, current?.chartEtf?.code);
  const { fundPoints, fundPhase } = useFundSeries(current?.chartFund?.code);
  const cmb = useCmbFxSeries(current?.chartBankFx === true);
  const [span, setSpan] = useState<CloseSpan>('5');
  const [levelId, setLevelId] = useState<string | null>(defaultLevelId(current?.levels ?? []));

  useResetOnChange(code, () => setLevelId(defaultLevelId(current?.levels ?? [])));

  const close = useMemo(() => latestClose(code, points, phase), [code, points, phase]);
  const windowed = useMemo(() => sliceSpan(points, span), [points, span]);
  const etfWindow = useMemo(
    () => sliceSpan(etfPoints, span, windowed[windowed.length - 1]?.tradeDate),
    [etfPoints, span, windowed]
  );
  const fundWindow = useMemo(
    () => sliceSpan(fundPoints, span, windowed[windowed.length - 1]?.tradeDate),
    [fundPoints, span, windowed]
  );
  const levelPoints = useMemo(() => (current?.levels ?? []).map(level => level.point), [current]);

  if (!current) return null;
  const selected = current.levels.find(level => String(level.point) === levelId) ?? null;
  const edge = close ? brackets(close.close, current.levels) : { below: null, above: null };
  const quotes = selected ? quotesForLevel(current.quotes, selected, current.levels) : [];
  const chooseLevel = (id: string) => setLevelId(currentId => (currentId === id ? null : id));

  return (
    <>
      <p className="crumb">
        <a href="/">工具集</a>
        {' / '}
        点位跟踪
      </p>
      <TrackerHead current={current} date={close?.tradeDate} onSelect={setCode} />

      <section className="panel">
        <div className="group-head">
          <div className="readout">
            <div className="quote">
              <div className="px-row">
                <b className="px">{close ? formatClose(close.close) : '—'}</b>
                <ChangeText close={close} />
              </div>
              <GapText below={edge.below} above={edge.above} />
            </div>
            <div className="time-side">
              <div className="tabs" role="group" aria-label="时间范围">
                {SPANS.map(item => (
                  <button
                    key={item.id}
                    type="button"
                    className={span === item.id ? 'tab active' : 'tab'}
                    aria-pressed={span === item.id}
                    onClick={() => setSpan(item.id)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
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
          phase={phase}
          span={span}
          levels={levelPoints}
          activeLevel={selected?.point ?? null}
          onActiveLevel={selected ? () => chooseLevel(String(selected.point)) : undefined}
        />
        {current.levels.length > 0 ? (
          <div className="level-picker" role="group" aria-label="关键点位">
            {current.levels.map(level => (
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
        {quotes.length > 0 ? <QuoteSheet quotes={quotes} /> : null}
      </section>

      <CmbFxCharts enabled={current.chartBankFx === true} quotes={cmb} span={span} end={windowed[windowed.length - 1]?.tradeDate} />

      <LinkedFundCharts
        watch={current}
        etfPoints={etfWindow}
        fundPoints={fundWindow}
        phase={phase}
        fundPhase={fundPhase}
        span={span}
      />
    </>
  );
}

/** 招行美元汇买、汇卖。未配置时不请求。 */
function useCmbFxSeries(enabled: boolean): { points: CmbUsdQuotes; phase: Phase } {
  const [points, setPoints] = useState<CmbUsdQuotes>({ bid: [], ask: [] });
  const [phase, setPhase] = useState<Phase>(enabled ? 'loading' : 'ready');

  useResetOnChange(enabled, () => {
    setPoints({ bid: [], ask: [] });
    setPhase(enabled ? 'loading' : 'ready');
  });

  useEffect(() => {
    let cancelled = false;
    setPoints({ bid: [], ask: [] });
    if (!enabled) {
      setPhase('ready');
      return undefined;
    }
    setPhase('loading');
    fetch('/api/index-levels/cmb-fx')
      .then(response => {
        if (!response.ok) throw new Error('cmb fx failed');
        return response.json() as Promise<Partial<CmbUsdQuotes>>;
      })
      .then(body => {
        if (cancelled) return;
        setPoints({ bid: body.bid ?? [], ask: body.ask ?? [] });
        setPhase('ready');
      })
      .catch(() => {
        if (!cancelled) setPhase('error');
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { points, phase };
}

const CMB_ASK_HELP = '在招行买入美元（购汇）的成交价，即银行卖出价。按 1 美元计。';
const CMB_BID_HELP = '把美元卖给招行（结汇）的成交价，即银行买入价。按 1 美元计。';

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
  quotes: { points: CmbUsdQuotes; phase: Phase };
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
            <span className="title-help"><HelpTooltip title={CMB_ASK_HELP} /></span>
          </h3>
          <IndexLevelChart bare presliced name="招行汇卖" code="USD.ASK" points={ask} phase={quotes.phase} span={span} priceDigits={5} marks={CMB_USD_BUY_MARKS} />
        </article>
        <article className="fund-panel">
          <h3 className="fund-title">
            招行汇买 <span className="code">USD.BID</span>
            <span className="title-help"><HelpTooltip title={CMB_BID_HELP} /></span>
          </h3>
          <IndexLevelChart bare presliced name="招行汇买" code="USD.BID" points={bid} phase={quotes.phase} span={span} priceDigits={4} />
        </article>
      </div>
    </section>
  );
}

/** 页头：指数名在左，日期在名字下面，跟踪指数在右。 */
function TrackerHead({
  current,
  date,
  onSelect,
}: {
  current: IndexWatch;
  date?: string;
  onSelect: (next: string) => void;
}) {
  return (
    <header className="head">
      <div className="title-block">
        <h1>
          {current.name} <span className="code">{current.code}</span>
        </h1>
        <time className="page-date" dateTime={date}>{date ? date.replaceAll('-', '/') : '—'}</time>
      </div>
      <label className="selector">
        <span className="selector-label">跟踪指数</span>
        <IndexLevelPicker value={current.code} onChange={onSelect} />
      </label>
    </header>
  );
}

const ETF_TRADE_MARKS: Record<string, EtfTradeMark[]> = {
  '512980': MEDIA_ETF_TRADES,
  '512880': SECURITIES_ETF_TRADES,
};

const FUND_TRADE_MARKS: Record<string, EtfTradeMark[]> = {
  '004752': MEDIA_LINK_TRADES,
  '502010': SECURITIES_LINK_TRADES,
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
  span,
}: {
  watch: IndexWatch;
  etfPoints: IndexClosePoint[];
  fundPoints: IndexClosePoint[];
  phase: Phase;
  fundPhase: Phase;
  span: CloseSpan;
}) {
  const etf = watch.chartEtf ? (
    <article className="fund-panel" key={watch.chartEtf.code}>
      <h3 className="fund-title">
        {watch.chartEtf.name} <span className="code">{watch.chartEtf.code}</span>
      </h3>
      <IndexLevelChart
        bare
        presliced
        name={watch.chartEtf.name}
        code={watch.chartEtf.code}
        points={etfPoints}
        phase={phase}
        span={span}
        marks={ETF_TRADE_MARKS[watch.chartEtf.code] ?? []}
        priceDigits={3}
      />
    </article>
  ) : null;
  const fund = watch.chartFund ? (
    <article className="fund-panel" key={watch.chartFund.code}>
      <h3 className="fund-title">
        {watch.chartFund.href ? (
          <a href={watch.chartFund.href} target="_blank" rel="noreferrer">{watch.chartFund.name}</a>
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
      <div className={etf && fund ? 'fund-grid' : 'fund-grid is-single'}>{etf}{fund}</div>
    </section>
  );
}

function QuoteSheet({ quotes }: { quotes: IndexQuote[] }) {
  return (
    <section className="level-sheet" aria-live="polite" aria-label="E大贴文">
      {quotes.map(quote => (
        <article className="utter" key={quote.postId}>
          <time dateTime={quote.date}>{quote.date.replaceAll('-', '/')}</time>
          <p className="words">
            {quote.text}{' '}
            <a href={quoteHref(quote)} target="_blank" rel="noreferrer">查看原文</a>
          </p>
        </article>
      ))}
    </section>
  );
}

function ChangeText({ close }: { close: IndexLatestClose | null }) {
  if (!close) return <span className="chg">—</span>;
  const change = changePct(close.close, close.previousClose);
  const kind = classifyChange(change);
  const text = change == null ? '—' : `${change > 0 ? '+' : ''}${change.toFixed(2)}%`;
  return <span className={`chg ${kind}`}>{text}</span>;
}

function GapText({ below, above }: { below: IndexLevelMark | null; above: IndexLevelMark | null }) {
  if (!below || !above) return <span className="gap">—</span>;
  return (
    <span className="gap">
      介于 <b>{`${below.name} ${formatMarkLabel(below.label)}`}</b>
      {' 与 '}
      <b>{`${above.name} ${formatMarkLabel(above.label)}`}</b>
    </span>
  );
}

function defaultLevelId(levels: IndexLevelMark[]): string | null {
  const picked = levels.find(level => level.name === '压力') ?? levels[0];
  return picked ? String(picked.point) : null;
}

function brackets(close: number, levels: IndexLevelMark[]): { below: IndexLevelMark | null; above: IndexLevelMark | null } {
  const sorted = [...levels].sort((a, b) => a.point - b.point);
  return {
    below: [...sorted].reverse().find(level => level.point <= close) ?? null,
    above: sorted.find(level => level.point > close) ?? null,
  };
}

/** 原文属于哪一档：点位数字对上，差 10 点以内的近邻（如 1403 → 1400）也算。 */
function quotesForLevel(quotes: IndexQuote[], level: IndexLevelMark, levels: IndexLevelMark[]): IndexQuote[] {
  return quotes
    .filter(quote => quoteMentions(quote.level, level, levels))
    .sort((a, b) => a.date.localeCompare(b.date) || a.postId - b.postId);
}

function quoteMentions(text: string, level: IndexLevelMark, levels: IndexLevelMark[]): boolean {
  if (levels.length === 0) return false;
  const numbers = numbersIn(text);
  if (numbers.some(value => value === level.point)) return true;
  const exact = levels.some(item => numbers.some(value => value === item.point));
  if (exact) return false;
  return numbers.some(value => {
    const nearest = levels.reduce((best, item) => (Math.abs(item.point - value) < Math.abs(best.point - value) ? item : best));
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

function sliceSpan(points: IndexClosePoint[], span: CloseSpan, endDate?: string): IndexClosePoint[] {
  if (span === 'all' || points.length === 0) return points;
  const end = endDate || points[points.length - 1].tradeDate;
  const [year, month, day] = end.split('-');
  const cut = `${Number(year) - Number(span)}-${month}-${day}`;
  return points.filter(point => point.tradeDate >= cut && point.tradeDate <= end);
}

function latestClose(code: string, points: IndexClosePoint[], phase: Phase): IndexLatestClose | null {
  if (phase !== 'ready') return null;
  const latest = points[points.length - 1];
  if (!latest) return null;
  return {
    indexCode: code,
    tradeDate: latest.tradeDate,
    close: latest.close,
    previousClose: points[points.length - 2]?.close ?? null,
  };
}
