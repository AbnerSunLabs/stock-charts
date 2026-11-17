'use client';

import { useEffect, useState } from 'react';

import {
  journalTradesToMarks,
  type EtfJournalMarks,
} from '@/lib/index-levels/etf-journal-marks';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { GridStrategyRepository } from '@/lib/supabase/grid-strategy-repository';
import { GridStrategyTradeRepository } from '@/lib/supabase/grid-strategy-trade-repository';

/**
 * 已登录时读当前用户网格流水。切回这个标签页或登录态变化时再读一次。
 */
export function useEtfJournalMarks(etfCode?: string): EtfJournalMarks {
  const [state, setState] = useState<EtfJournalMarks>({ status: 'pending' });

  useEffect(() => {
    if (!etfCode) {
      setState({ status: 'signed-out' });
      return undefined;
    }
    let cancelled = false;
    const load = () => {
      void fetchJournalEtfMarks(etfCode)
        .then(next => {
          if (!cancelled) setState(next);
        })
        .catch(() => {
          if (!cancelled) {
            setState(current => (current.status === 'live' ? current : { status: 'signed-out' }));
          }
        });
    };
    load();
    const onVisible = () => {
      if (document.visibilityState === 'visible') load();
    };
    document.addEventListener('visibilitychange', onVisible);
    const { data } = createBrowserSupabaseClient().auth.onAuthStateChange(() => load());
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      data.subscription.unsubscribe();
    };
  }, [etfCode]);

  return state;
}

async function fetchJournalEtfMarks(etfCode: string): Promise<EtfJournalMarks> {
  const client = createBrowserSupabaseClient();
  const { data } = await client.auth.getSession();
  if (!data.session) return { status: 'signed-out' };
  const strategies = await new GridStrategyRepository(client).list();
  const trades = await new GridStrategyTradeRepository(client).list();
  return {
    status: 'live',
    marks: journalTradesToMarks(strategies, trades, etfCode),
  };
}
