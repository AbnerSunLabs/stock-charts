import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  GridStrategyTrade,
  GridStrategyTradeCreatePayload,
} from '@/types/grid-strategy-trade';
import {
  assertTradeCreatePayload,
  parseGridStrategyTrade,
} from '@/lib/grid/grid-strategy-trade-parse';
import { assertSellWithinOpenQty } from '@/lib/grid/grid-strategy-trade-stats';

function mapPostgrestError(error: {
  code?: string;
  message: string;
  details?: string;
  hint?: string;
}): Error {
  console.error(
    '[grid_strategy_trades]',
    error.code,
    error.message,
    error.details,
    error.hint
  );

  if (error.code === '42501') {
    return new Error('没有权限访问该流水');
  }
  if (
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    /relation .* does not exist/i.test(error.message) ||
    /could not find the table/i.test(error.message)
  ) {
    return new Error('成交流水表尚未就绪，请先应用数据库 migration 后重试');
  }
  if (error.code === '23503') {
    return new Error('策略不存在或无权访问');
  }
  return new Error('操作失败，请稍后重试');
}

/**
 * 网格策略成交流水仓储。
 */
export class GridStrategyTradeRepository {
  constructor(private readonly client: SupabaseClient) {}

  private async requireUserId(): Promise<string> {
    const { data, error } = await this.client.auth.getUser();
    if (error || !data.user) {
      throw new Error('登录状态已失效，请重新登录');
    }
    return data.user.id;
  }

  /** 列出当前用户全部流水（可选按策略过滤） */
  async list(strategyId?: string): Promise<GridStrategyTrade[]> {
    const userId = await this.requireUserId();
    let query = this.client
      .from('grid_strategy_trades')
      .select('*')
      .eq('user_id', userId)
      .order('trade_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (strategyId) {
      query = query.eq('strategy_id', strategyId);
    }

    const { data, error } = await query;
    if (error) throw mapPostgrestError(error);
    return (data ?? []).map(row => parseGridStrategyTrade(row));
  }

  /** 新建一笔流水；卖出前校验 openQty */
  async create(payload: GridStrategyTradeCreatePayload): Promise<GridStrategyTrade> {
    const userId = await this.requireUserId();
    const normalized = assertTradeCreatePayload(payload);

    if (normalized.side === 'sell') {
      const existing = await this.list(normalized.strategyId);
      assertSellWithinOpenQty(existing, normalized.levelKey, normalized.qty);
    }

    const { data, error } = await this.client
      .from('grid_strategy_trades')
      .insert({
        user_id: userId,
        strategy_id: normalized.strategyId,
        level_key: normalized.levelKey,
        side: normalized.side,
        price: normalized.price,
        qty: normalized.qty,
        trade_date: normalized.tradeDate,
      })
      .select('*')
      .single();

    if (error) throw mapPostgrestError(error);
    if (!data) throw new Error('记账失败，请重试');
    return parseGridStrategyTrade(data);
  }

  /** 删除一笔流水；仅允许删除该档时间序最后一笔，避免破坏 FIFO */
  async delete(id: string): Promise<void> {
    const userId = await this.requireUserId();
    const { data: existing, error: readError } = await this.client
      .from('grid_strategy_trades')
      .select('*')
      .eq('user_id', userId)
      .eq('id', id)
      .maybeSingle();

    if (readError) throw mapPostgrestError(readError);
    if (!existing) throw new Error('流水不存在或无权访问');

    const target = parseGridStrategyTrade(existing);
    const levelTrades = await this.list(target.strategyId);
    const sameLevel = levelTrades
      .filter(t => t.levelKey === target.levelKey)
      .sort(
        (a, b) =>
          a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)
      );
    const last = sameLevel[sameLevel.length - 1];
    if (!last || last.id !== id) {
      throw new Error('只能删除该档最近一笔流水，请按时间倒序撤销');
    }

    const { data, error } = await this.client
      .from('grid_strategy_trades')
      .delete()
      .eq('user_id', userId)
      .eq('id', id)
      .select('id')
      .maybeSingle();

    if (error) throw mapPostgrestError(error);
    if (!data) throw new Error('流水不存在或无权访问');
  }
}
