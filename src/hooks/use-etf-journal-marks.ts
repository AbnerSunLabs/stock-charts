'use client';

import { useEffect, useState } from 'react';

import {
  journalTradesToMarks,
  type EtfJournalMarks,
} from '@/lib/index-levels/etf-journal-marks';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { GridStrategyRepository } from '@/lib/supabase/grid-strategy-repository';
import { GridStrategyTradeRepository } from '@/lib/supabase/grid-strategy-trade-repository';

/** 页面还开着时，隔这段时间再对一次流水。 */
const JOURNAL_MARK_REFRESH_MS = 15_000;

/**
 * 已登录时读当前用户网格流水。
 * 回到标签页、窗口重新聚焦，或页面开着时每隔一段时间再读，流水变更会画到折线上。
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
    const refreshIfVisible = () => {
      if (document.visibilityState === 'visible') load();
    };
    load();
    document.addEventListener('visibilitychange', refreshIfVisible);
    window.addEventListener('focus', refreshIfVisible);
    const timer = window.setInterval(refreshIfVisible, JOURNAL_MARK_REFRESH_MS);
    const { data } = createBrowserSupabaseClient().auth.onAuthStateChange(() => load());
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', refreshIfVisible);
      window.removeEventListener('focus', refreshIfVisible);
      window.clearInterval(timer);
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
