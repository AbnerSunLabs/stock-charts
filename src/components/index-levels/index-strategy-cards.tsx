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
  const codes = funds.map(fund => fund.code).join(',');

  useEffect(() => {
    const watched = new Set(codes.split(',').filter(Boolean));
    if (watched.size === 0) {
      setViews([]);
      return undefined;
    }
    let cancelled = false;
    const client = createBrowserSupabaseClient();
    void loadStrategyCards(client, watched).then(next => {
      if (!cancelled) setViews(next);
    });
    return () => {
      cancelled = true;
    };
  }, [codes]);

  if (views.length === 0) return null;

  return (
    <div className="grid-shell index-strategy-cards">
      {views.map(view => (
        <GridPortfolioCard
          key={view.s.id}
          view={view}
          onOpenCalculator={id => router.push(`/view/grid?tab=calc&strategy=${id}`)}
          onOpenJournal={id => router.push(`/view/grid?tab=journal&strategy=${id}`)}
        />
      ))}
    </div>
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
