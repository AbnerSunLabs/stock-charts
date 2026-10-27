'use client';

import { useEffect, useState } from 'react';

import { IndexLevelChart } from '@/components/index-levels/index-level-chart';
import { IndexLevelGauge } from '@/components/index-levels/index-level-gauge';
import { IndexLevelPicker } from '@/components/index-levels/index-level-picker';
import { IndexQuoteLedger } from '@/components/index-levels/index-quote-ledger';
import { IndexTrackingFunds } from '@/components/index-levels/index-tracking-funds';
import { INDEX_WATCHES } from '@/lib/index-levels/catalog';
import type { IndexClosePoint } from '@/lib/index-levels/close-series';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { fetchHeldEtfCodes, fetchTrackingEtfs, type TrackingEtf } from '@/lib/supabase/etf-pool-repository';
import { fetchIndexCloseSeries, type IndexLatestClose } from '@/lib/supabase/index-daily-repository';

type Phase = 'loading' | 'ready' | 'error';

/**
 * 跟踪指数：左侧官方收盘折线和原文，右侧仪表盘与跟踪 ETF。
 */
export function IndexLevelTracker() {
  const [code, setCode] = useState(INDEX_WATCHES[0]?.code ?? '');
  const [points, setPoints] = useState<IndexClosePoint[]>([]);
  const [funds, setFunds] = useState<TrackingEtf[]>([]);
  const [held, setHeld] = useState<Set<string>>(new Set());
  const [phase, setPhase] = useState<Phase>('loading');
  const current = INDEX_WATCHES.find(item => item.code === code) ?? INDEX_WATCHES[0];

  useEffect(() => {
    if (!code) return undefined;
    let cancelled = false;
    setPhase('loading');
    setPoints([]);
    setFunds([]);
    const client = createBrowserSupabaseClient();
    Promise.all([fetchIndexCloseSeries(client, code), fetchTrackingEtfs(client, code), fetchHeldEtfCodes(client)])
      .then(([series, tracking, owned]) => {
        if (cancelled) return;
        setPoints(series);
        setFunds(tracking);
        setHeld(owned);
        setPhase('ready');
      })
      .catch(() => {
        if (!cancelled) setPhase('error');
      });
    return () => {
      cancelled = true;
    };
  }, [code]);

  if (!current) return null;
  const close = latestClose(current.code, points, phase);

  return (
    <>
      <p className="index-label">指数</p>
      <IndexLevelPicker value={current.code} onChange={setCode} />
      <div className="stage">
        <div className="col">
          <IndexLevelChart name={current.name} points={points} phase={phase} />
          <section className="card ledger-card" aria-label="原文">
            <IndexQuoteLedger quotes={current.quotes} />
          </section>
        </div>
        <div className="col">
          <IndexLevelGauge levels={current.levels} close={close} phase={phase} />
          <IndexTrackingFunds funds={funds} held={held} phase={phase} />
        </div>
      </div>
    </>
  );
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
