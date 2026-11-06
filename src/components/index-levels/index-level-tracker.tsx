'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { IndexLevelChart } from '@/components/index-levels/index-level-chart';
import { IndexLevelGauge } from '@/components/index-levels/index-level-gauge';
import { IndexLevelPicker } from '@/components/index-levels/index-level-picker';
import { IndexQuoteLedger } from '@/components/index-levels/index-quote-ledger';
import { INDEX_WATCHES, resolveWatchedIndex } from '@/lib/index-levels/catalog';
import { MEDIA_ETF_TRADES } from '@/lib/index-levels/media-etf-trades';
import { MEDIA_LINK_TRADES } from '@/lib/index-levels/media-link-trades';
import type { IndexClosePoint } from '@/lib/index-levels/close-series';
import { formatClose } from '@/lib/index-levels/position';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { fetchEtfCloseSeries } from '@/lib/supabase/etf-daily-repository';
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
 * 点位跟踪：面包屑与页头，指数折线 + 估值仪表盘并排，ETF 与联接基金各占一整行，
 * 底下是原文摘录和关键点位速览。当前指数写在 query `index` 上。
 */
export function IndexLevelTracker() {
  const [code, setCode] = useWatchedIndex();
  const [points, setPoints] = useState<IndexClosePoint[]>([]);
  const [etfPoints, setEtfPoints] = useState<IndexClosePoint[]>([]);
  const [fundPoints, setFundPoints] = useState<IndexClosePoint[]>([]);
  const [fundPhase, setFundPhase] = useState<Phase>('ready');
  const [phase, setPhase] = useState<Phase>('loading');
  const current = INDEX_WATCHES.find(item => item.code === code) ?? INDEX_WATCHES[0];

  useEffect(() => {
    if (!code) return undefined;
    const watch = INDEX_WATCHES.find(item => item.code === code);
    let cancelled = false;
    setPhase('loading');
    setPoints([]);
    setEtfPoints([]);
    setFundPoints([]);
    const client = createBrowserSupabaseClient();
    const chartEtfCode = watch?.chartEtf?.code;
    const chartFundCode = watch?.chartFund?.code;
    if (chartFundCode) {
      setFundPhase('loading');
      fetch(`/api/index-levels/fund-nav?code=${chartFundCode}`)
        .then(response => {
          if (!response.ok) throw new Error('fund nav failed');
          return response.json() as Promise<{ points?: IndexClosePoint[] }>;
        })
        .then(body => {
          if (!cancelled) {
            setFundPoints(body.points ?? []);
            setFundPhase('ready');
          }
        })
        .catch(() => {
          if (!cancelled) setFundPhase('error');
        });
    } else {
      setFundPhase('ready');
    }
    Promise.all([
      fetchIndexCloseSeries(client, code),
      chartEtfCode ? fetchEtfCloseSeries(client, chartEtfCode) : Promise.resolve(null),
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
  }, [code]);

  const close = useMemo(() => latestClose(code, points, phase), [code, points, phase]);

  if (!current) return null;
  const levels = current.levels;
  const sorted = [...levels].sort((a, b) => a.point - b.point);
  const observed = close ? [...sorted].reverse().find(level => level.point <= close.close) : null;
  const reference = close ? sorted.find(level => level.point > close.close) : null;
  const bottom = sorted[0]?.point;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>指数点位跟踪</h1>
          <div className="subtitle">跟踪指数估值位置、历史区间与关联 ETF 的买卖信号</div>
        </div>
        <div className="selector-wrap">
          <span className="field-label">跟踪指数</span>
          <IndexLevelPicker value={current.code} onChange={setCode} />
        </div>
      </div>

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

      {current.chartEtf ? (
        <IndexLevelChart
          wide
          name={current.chartEtf.name}
          code={current.chartEtf.code}
          points={etfPoints}
          phase={phase}
          marks={current.chartEtf.code === '512980' ? MEDIA_ETF_TRADES : []}
          priceDigits={3}
        />
      ) : null}

      {current.chartFund ? (
        <IndexLevelChart
          wide
          name={current.chartFund.name}
          code={current.chartFund.code}
          points={fundPoints}
          phase={fundPhase}
          marks={current.chartFund.code === '004752' ? MEDIA_LINK_TRADES : []}
          priceDigits={4}
        />
      ) : null}

      <section className="note-area">
        <section className="panel notes" aria-label="历史观点摘录">
          <div className="notes-head">
            <div className="panel-title">历史观点摘录</div>
            <span className="pill">{current.quotes.length} 条记录</span>
          </div>
          <IndexQuoteLedger quotes={current.quotes} />
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

      <div className="footer">
        <span>点位跟踪 · 仅作数据观察与策略研究</span>
        <span>收盘为已结算序列</span>
      </div>
    </>
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
