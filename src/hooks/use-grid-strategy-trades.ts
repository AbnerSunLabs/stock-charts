'use client';

import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { GridStrategyTradeRepository } from '@/lib/supabase/grid-strategy-trade-repository';
import type {
  GridStrategyTrade,
  GridStrategyTradeCreatePayload,
} from '@/types/grid-strategy-trade';
import { useCallback, useEffect, useMemo, useState } from 'react';

export interface UseGridStrategyTradesOptions {
  enabled: boolean;
  repository?: GridStrategyTradeRepository;
}

/**
 * 登录后加载/刷新网格成交流水。
 */
export function useGridStrategyTrades(options: UseGridStrategyTradesOptions) {
  const repo = useMemo(
    () =>
      options.repository ??
      new GridStrategyTradeRepository(createBrowserSupabaseClient()),
    [options.repository]
  );

  const [trades, setTrades] = useState<GridStrategyTrade[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!options.enabled) {
      setTrades([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const list = await repo.list();
      setTrades(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载流水失败');
      setTrades([]);
    } finally {
      setLoading(false);
    }
  }, [options.enabled, repo]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createTrade = useCallback(
    async (payload: GridStrategyTradeCreatePayload) => {
      const created = await repo.create(payload);
      setTrades(prev => [created, ...prev]);
      return created;
    },
    [repo]
  );

  const deleteTrade = useCallback(
    async (id: string) => {
      await repo.delete(id);
      setTrades(prev => prev.filter(t => t.id !== id));
    },
    [repo]
  );

  return {
    trades,
    loading,
    error,
    refresh,
    createTrade,
    deleteTrade,
  };
}
