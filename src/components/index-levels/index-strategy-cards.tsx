'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { GridPortfolioCard, toPortfolioCardView, type PortfolioCardView } from '@/components/grid/grid-portfolio-card';
import { extractEtfCode } from '@/lib/grid/grid-board-close-quote';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { fetchLatestEtfCloses } from '@/lib/supabase/etf-daily-repository';
import type { TrackingEtf } from '@/lib/supabase/etf-pool-repository';
import { GridStrategyRepository } from '@/lib/supabase/grid-strategy-repository';
import { GridStrategyTradeRepository } from '@/lib/supabase/grid-strategy-trade-repository';

import '@/app/view/grid/grid.css';

/**
 * 把组合里跟踪当前指数的策略卡原样放在点位页。未登录时不显示。
 */
export function IndexStrategyCards({ funds }: { funds: TrackingEtf[] }) {
  const router = useRouter();
  const [views, setViews] = useState<PortfolioCardView[]>([]);
  const [ready, setReady] = useState(false);
  const codes = funds.map(fund => fund.code).join(',');

  useEffect(() => {
    const watched = new Set(codes.split(',').filter(Boolean));
    if (watched.size === 0) {
      setViews([]);
      setReady(true);
      return undefined;
    }
    let cancelled = false;
    setReady(false);
    const client = createBrowserSupabaseClient();
    void loadStrategyCards(client, watched).then(next => {
      if (!cancelled) {
        setViews(next);
        setReady(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [codes]);

  const held = new Set(views.map(view => extractEtfCode(view.s.symbol)).filter(Boolean));
  const unmatched = ready ? funds.filter(fund => !held.has(fund.code)) : [];
  if (views.length === 0 && unmatched.length === 0) return null;

  return (
    <div className="index-strategy-cards">
      {views.length > 0 ? (
        <div className="grid-shell">
          {views.map(view => (
            <GridPortfolioCard
              key={view.s.id}
              view={view}
              onOpenCalculator={id => router.push(`/view/grid?tab=calc&strategy=${id}`)}
              onOpenJournal={id => router.push(`/view/grid?tab=journal&strategy=${id}`)}
            />
          ))}
        </div>
      ) : null}
      {unmatched.length > 0 ? <TrackingFundCard funds={unmatched} /> : null}
    </div>
  );
}

function TrackingFundCard({ funds }: { funds: TrackingEtf[] }) {
  return (
    <section className="card funds-card" aria-label="跟踪这只指数的 ETF">
      <h2>跟踪这只指数的 ETF</h2>
      {funds.map(fund => (
        <div className="fund" key={fund.code}>
          <div>
            <b>{fund.name}</b>
            <span>{fund.code}</span>
          </div>
        </div>
      ))}
    </section>
  );
}

async function loadStrategyCards(
  client: ReturnType<typeof createBrowserSupabaseClient>,
  watched: Set<string>
): Promise<PortfolioCardView[]> {
  const { data } = await client.auth.getSession();
  if (!data.session) return [];
  try {
    const strategies = await new GridStrategyRepository(client).listAll();
    const matched = strategies.filter(strategy => {
      const code = extractEtfCode(strategy.symbol);
      return code != null && watched.has(code);
    });
    if (matched.length === 0) return [];
    const trades = await new GridStrategyTradeRepository(client).list();
    const closes = await fetchLatestEtfCloses(
      client,
      matched.map(strategy => extractEtfCode(strategy.symbol)).filter((code): code is string => code != null)
    );
    return matched.map(strategy => {
      const code = extractEtfCode(strategy.symbol);
      return toPortfolioCardView(strategy, trades, code ? closes.get(code) : undefined);
    });
  } catch {
    return [];
  }
}
