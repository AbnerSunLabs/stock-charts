'use client';

import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { GridStrategyTradeRepository } from '@/lib/supabase/grid-strategy-trade-repository';
import type {
  GridStrategyTrade,
  GridStrategyTradeCreatePayload,
} from '@/types/grid-strategy-trade';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export interface UseGridStrategyTradesOptions {
  enabled: boolean;
  repository?: GridStrategyTradeRepository;
}

/**
 * 登录后加载/刷新网格成交流水。
 */
export function useGridStrategyTrades(options: UseGridStrategyTradesOptions) {
  const repo = useMemo(() => {
    if (options.repository) return options.repository;
    if (!options.enabled) return null;
    return new GridStrategyTradeRepository(createBrowserSupabaseClient());
  }, [options.enabled, options.repository]);

  const [trades, setTrades] = useState<GridStrategyTrade[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 请求代际：登出/禁用后作废在途请求，防止旧账号响应写回
  const epochRef = useRef(0);

  const refresh = useCallback(async () => {
    if (!options.enabled) {
      epochRef.current += 1;
      setTrades([]);
      setError(null);
      return;
    }
    const epoch = ++epochRef.current;
    setLoading(true);
    try {
      if (!repo) {
        setTrades([]);
        return;
      }
      const list = await repo.list();
      if (epoch !== epochRef.current) return;
      setTrades(list);
      // 成功才清错误：重试期间保留失败提示，用户不失去"正在重试"的语境
      setError(null);
    } catch (e) {
      if (epoch !== epochRef.current) return;
      // 刷新失败保留上次数据：把"读失败"误当"无流水"会让人误判持仓与收益
      setError(e instanceof Error ? e.message : '加载流水失败');
    } finally {
      if (epoch === epochRef.current) setLoading(false);
    }
  }, [options.enabled, repo]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createTrade = useCallback(
    async (payload: GridStrategyTradeCreatePayload) => {
      if (!repo) {
        throw new Error('未登录，无法记账');
      }
      const created = await repo.create(payload);
      setTrades(prev => [created, ...prev]);
      return created;
    },
    [repo]
  );

  const deleteTrade = useCallback(
    async (id: string) => {
      if (!repo) {
        throw new Error('未登录，无法删除流水');
      }
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
