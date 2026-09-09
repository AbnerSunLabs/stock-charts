import type { SupabaseClient } from '@supabase/supabase-js';
import {
  GRID_STRATEGY_SCHEMA_VERSION,
  type GridStrategyMetadata,
  type GridStrategySavePayload,
  type SavedGridStrategyV1,
} from '@/types/grid-strategy-storage';
import {
  assertSuccessfulGridSnapshot,
  normalizeGridStrategyName,
  parseGridStrategyMetadata,
  parseSavedGridStrategy,
} from '@/lib/grid/grid-strategy-storage';
import { normalizeGridStrategySymbol } from '@/lib/grid/grid-strategy-trade-parse';

function mapPostgrestError(error: {
  code?: string;
  message: string;
  details?: string;
  hint?: string;
}): Error {
  // 保留原始错误便于本地排查（不展示给用户）
  console.error('[grid_strategies]', error.code, error.message, error.details, error.hint);

  if (error.code === '23505') {
    return new Error('已有同名策略，请更换名称');
  }
  if (error.code === '42501') {
    return new Error('没有权限访问该策略');
  }
  // 表未创建 / schema cache 未刷新
  if (
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    /relation .* does not exist/i.test(error.message) ||
    /could not find the table/i.test(error.message)
  ) {
    return new Error('策略保存表尚未就绪，请先应用数据库 migration 后重试');
  }
  return new Error('操作失败，请稍后重试');
}

/**
 * 网格策略云端仓储：按当前用户 CRUD，显式过滤 user_id。
 */
export class GridStrategyRepository {
  constructor(private readonly client: SupabaseClient) {}

  private async requireUserId(): Promise<string> {
    const { data, error } = await this.client.auth.getUser();
    if (error || !data.user) {
      throw new Error('登录状态已失效，请重新登录');
    }
    return data.user.id;
  }

  /** 列出当前用户完整策略（看板用，含 JSONB） */
  async listAll(): Promise<SavedGridStrategyV1[]> {
    const userId = await this.requireUserId();
    const { data, error } = await this.client
      .from('grid_strategies')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (error) throw mapPostgrestError(error);
    return (data ?? []).map(row => parseSavedGridStrategy(row));
  }

  /** 列出当前用户策略元数据（不含 JSONB） */
  async list(): Promise<GridStrategyMetadata[]> {
    const userId = await this.requireUserId();
    const { data, error } = await this.client
      .from('grid_strategies')
      .select('id,name,symbol,schema_version,created_at,updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (error) throw mapPostgrestError(error);
    return (data ?? []).map(row => parseGridStrategyMetadata(row));
  }

  /** 读取完整策略（含 config / snapshot） */
  async get(id: string): Promise<SavedGridStrategyV1> {
    const userId = await this.requireUserId();
    const { data, error } = await this.client
      .from('grid_strategies')
      .select('*')
      .eq('user_id', userId)
      .eq('id', id)
      .maybeSingle();

    if (error) throw mapPostgrestError(error);
    if (!data) throw new Error('策略不存在或无权访问');
    return parseSavedGridStrategy(data);
  }

  /** 新建策略 */
  async create(
    name: string,
    payload: GridStrategySavePayload
  ): Promise<SavedGridStrategyV1> {
    const userId = await this.requireUserId();
    const normalizedName = normalizeGridStrategyName(name);
    assertSuccessfulGridSnapshot(payload.resultSnapshot);
    const symbol = normalizeGridStrategySymbol(payload.symbol);
    const { data, error } = await this.client
      .from('grid_strategies')
      .insert({
        user_id: userId,
        name: normalizedName,
        symbol: symbol || null,
        schema_version: GRID_STRATEGY_SCHEMA_VERSION,
        config: payload.config,
        result_snapshot: payload.resultSnapshot,
      })
      .select('*')
      .single();

    if (error) throw mapPostgrestError(error);
    if (!data) throw new Error('保存失败，请重试');
    return parseSavedGridStrategy(data);
  }

  /** 覆盖配置与快照（不改名称） */
  async update(
    id: string,
    payload: GridStrategySavePayload
  ): Promise<SavedGridStrategyV1> {
    const userId = await this.requireUserId();
    assertSuccessfulGridSnapshot(payload.resultSnapshot);
    const updatedAt = new Date().toISOString();
    const patch: Record<string, unknown> = {
      config: payload.config,
      result_snapshot: payload.resultSnapshot,
      updated_at: updatedAt,
    };
    if (payload.symbol !== undefined) {
      const symbol = normalizeGridStrategySymbol(payload.symbol);
      patch.symbol = symbol || null;
    }
    const { data, error } = await this.client
      .from('grid_strategies')
      .update(patch)
      .eq('user_id', userId)
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (error) throw mapPostgrestError(error);
    if (!data) throw new Error('策略不存在或无权访问');
    return parseSavedGridStrategy(data);
  }

  /** 仅改名（可选同时改代码） */
  async rename(
    id: string,
    name: string,
    symbol?: string
  ): Promise<GridStrategyMetadata> {
    const userId = await this.requireUserId();
    const normalizedName = normalizeGridStrategyName(name);
    const updatedAt = new Date().toISOString();
    const patch: Record<string, unknown> = {
      name: normalizedName,
      updated_at: updatedAt,
    };
    if (symbol !== undefined) {
      const normalizedSymbol = normalizeGridStrategySymbol(symbol);
      patch.symbol = normalizedSymbol || null;
    }
    const { data, error } = await this.client
      .from('grid_strategies')
      .update(patch)
      .eq('user_id', userId)
      .eq('id', id)
      .select('id,name,symbol,schema_version,created_at,updated_at')
      .maybeSingle();

    if (error) throw mapPostgrestError(error);
    if (!data) throw new Error('策略不存在或无权访问');
    return parseGridStrategyMetadata(data);
  }

  /** 删除策略 */
  async delete(id: string): Promise<void> {
    const userId = await this.requireUserId();
    const { data, error } = await this.client
      .from('grid_strategies')
      .delete()
      .eq('user_id', userId)
      .eq('id', id)
      .select('id')
      .maybeSingle();

    if (error) throw mapPostgrestError(error);
    if (!data) throw new Error('策略不存在或无权访问');
  }
}
