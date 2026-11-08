'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { IndexLevelChart } from '@/components/index-levels/index-level-chart';
import { HelpTooltip } from '@/components/shared/help-tooltip';
import { IndexLevelGauge } from '@/components/index-levels/index-level-gauge';
import { IndexLevelPicker } from '@/components/index-levels/index-level-picker';
import { IndexQuoteLedger } from '@/components/index-levels/index-quote-ledger';
import {
  INDEX_WATCHES,
  resolveWatchedIndex,
  type IndexLevelMark,
  type IndexWatch,
} from '@/lib/index-levels/catalog';
import { MEDIA_ETF_TRADES, type EtfTradeMark } from '@/lib/index-levels/media-etf-trades';
import { MEDIA_LINK_TRADES } from '@/lib/index-levels/media-link-trades';
import { SECURITIES_ETF_TRADES } from '@/lib/index-levels/securities-etf-trades';
import { SECURITIES_LINK_TRADES } from '@/lib/index-levels/securities-link-trades';
import type { IndexClosePoint } from '@/lib/index-levels/close-series';
import type { CmbUsdQuotes } from '@/lib/index-levels/cmb-fx';
import { CMB_USD_BUY_MARKS } from '@/lib/index-levels/cmb-fx-trades';
import { formatClose } from '@/lib/index-levels/position';
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

/**
 * 点位跟踪：面包屑与页头，指数折线 + 估值仪表盘并排，ETF 与联接基金齐全时一行两列、
 * 只此一张时整行。美元兑人民币在折线下加招行汇卖、汇买一行两列。
 * 底下是原文摘录和关键点位速览。当前指数写在 query `index` 上。
 */
export function IndexLevelTracker() {
  const [code, setCode] = useWatchedIndex();
  const current = INDEX_WATCHES.find(item => item.code === code) ?? INDEX_WATCHES[0];
  const { points, etfPoints, phase } = useCloseSeries(code, current?.chartEtf?.code);
  const { fundPoints, fundPhase } = useFundSeries(current?.chartFund?.code);
  const cmb = useCmbFxSeries(current?.chartBankFx === true);

  const close = useMemo(() => latestClose(code, points, phase), [code, points, phase]);

  if (!current) return null;
  const levels = current.levels;
  const sorted = [...levels].sort((a, b) => a.point - b.point);
  const observed = close ? [...sorted].reverse().find(level => level.point <= close.close) : null;
  const reference = close ? sorted.find(level => level.point > close.close) : null;
  const bottom = sorted[0]?.point;

  return (
    <>
      <TrackerHead current={current} onSelect={setCode} />

      <section className="overview">
        <IndexLevelChart name={current.name} code={current.code} points={points} phase={phase} />
        <IndexLevelGauge
          levels={levels}
          quotes={current.quotes}
          close={close}
          phase={phase}
          mid={current.gauge?.mid}
        />
      </section>

      <CmbFxCharts enabled={current.chartBankFx === true} quotes={cmb} />

      <LinkedFundCharts
        watch={current}
        etfPoints={etfPoints}
        fundPoints={fundPoints}
        phase={phase}
        fundPhase={fundPhase}
      />

      <LevelNotes watch={current} close={close} observed={observed} reference={reference} bottom={bottom} />

      <div className="footer">
        <span>点位跟踪 · 仅作数据观察与策略研究</span>
        <span>收盘为已结算序列</span>
      </div>
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
function CmbFxCharts({ enabled, quotes }: { enabled: boolean; quotes: { points: CmbUsdQuotes; phase: Phase } }) {
  if (!enabled) return null;
  return (
    <section className="etf-fund-row" aria-label="招行美元汇卖与汇买">
      <IndexLevelChart
        wide
        name="招行汇卖"
        code="USD.ASK"
        points={quotes.points.ask}
        phase={quotes.phase}
        priceDigits={5}
        marks={CMB_USD_BUY_MARKS}
        titleHelp={<HelpTooltip title={CMB_ASK_HELP} />}
      />
      <IndexLevelChart
        wide
        name="招行汇买"
        code="USD.BID"
        points={quotes.points.bid}
        phase={quotes.phase}
        priceDigits={4}
        titleHelp={<HelpTooltip title={CMB_BID_HELP} />}
      />
    </section>
  );
}

/** 页头：标题与指数切换器。 */
function TrackerHead({ current, onSelect }: { current: IndexWatch; onSelect: (next: string) => void }) {
  return (
    <div className="page-head">
      <div>
        <h1>指数点位跟踪</h1>
        <div className="subtitle">跟踪指数估值位置、历史区间与关联 ETF 的买卖信号</div>
      </div>
      <div className="selector-wrap">
        <span className="field-label">跟踪指数</span>
        <IndexLevelPicker value={current.code} onChange={onSelect} />
      </div>
    </div>
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
}: {
  watch: IndexWatch;
  etfPoints: IndexClosePoint[];
  fundPoints: IndexClosePoint[];
  phase: Phase;
  fundPhase: Phase;
}) {
  const etf = watch.chartEtf ? (
    <IndexLevelChart
      wide
      name={watch.chartEtf.name}
      code={watch.chartEtf.code}
      points={etfPoints}
      phase={phase}
      marks={ETF_TRADE_MARKS[watch.chartEtf.code] ?? []}
      priceDigits={3}
    />
  ) : null;
  const fund = watch.chartFund ? (
    <IndexLevelChart
      wide
      name={watch.chartFund.name}
      code={watch.chartFund.code}
      points={fundPoints}
      phase={fundPhase}
      marks={FUND_TRADE_MARKS[watch.chartFund.code] ?? []}
      priceDigits={4}
      codeHref={watch.chartFund.href}
    />
  ) : null;

  if (etf && fund) {
    return (
      <section className="etf-fund-row" aria-label="关联 ETF 与场外基金走势">
        {etf}
        {fund}
      </section>
    );
  }
  return (
    <>
      {etf}
      {fund}
    </>
  );
}

/** 原文摘录台账 + 关键点位速览。 */
function LevelNotes({
  watch,
  close,
  observed,
  reference,
  bottom,
}: {
  watch: IndexWatch;
  close: IndexLatestClose | null;
  observed: IndexLevelMark | null | undefined;
  reference: IndexLevelMark | null | undefined;
  bottom?: number;
}) {
  return (
    <section className="note-area">
      <section className="panel notes" aria-label="历史观点摘录">
        <div className="notes-head">
          <div className="panel-title">历史观点摘录</div>
          <span className="pill">{watch.quotes.length} 条记录</span>
        </div>
        <IndexQuoteLedger quotes={watch.quotes} />
      </section>

      <aside className="panel insight">
        <h3>关键点位速览</h3>
        <div className="insight-row">
          <span>当前点位</span>
          <strong>{close ? formatClose(close.close) : '—'}</strong>
        </div>
        <div className="insight-row">
          <span>近期观察位</span>
          <strong>{observed ? formatPointLabel(observed.point) : '—'}</strong>
        </div>
        <div className="insight-row">
          <span>上方参考位</span>
          <strong>{reference ? formatPointLabel(reference.point) : '—'}</strong>
        </div>
        <div className="insight-row">
          <span>历史低位</span>
          <strong>{bottom == null ? '—' : formatPointLabel(bottom)}</strong>
        </div>
        <div className="insight-row">
          <span>数据更新时间</span>
          <strong>{close ? close.tradeDate.replaceAll('-', '/') : '—'}</strong>
        </div>
      </aside>
    </section>
  );
}

function formatPointLabel(value: number): string {
  if (Math.abs(value) < 10) return value.toFixed(2);
  return Math.round(value).toLocaleString('zh-CN');
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
