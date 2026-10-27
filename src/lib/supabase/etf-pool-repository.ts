import type { SupabaseClient } from '@supabase/supabase-js';

import { extractEtfCode } from '@/lib/grid/grid-board-close-quote';

/** 池子里跟踪某只指数的 ETF（只读） */
export interface TrackingEtf {
  code: string;
  name: string;
  indexCode: string;
}

/**
 * 按跟踪指数读取 ETF 池。读失败时返回空列表，不挡住点位页。
 */
export async function fetchTrackingEtfs(
  client: SupabaseClient,
  indexCode: string
): Promise<TrackingEtf[]> {
  const { data, error } = await client
    .from('etf_pool')
    .select('etf_code, etf_name, tracking_index_code')
    .eq('tracking_index_code', indexCode)
    .order('etf_code', { ascending: true });
  if (error || !data) return [];
  return data.flatMap(row => {
    const code = String(row.etf_code ?? '');
    const name = String(row.etf_name ?? '');
    const tracked = String(row.tracking_index_code ?? '');
    if (!code || !name || tracked !== indexCode) return [];
    return [{ code, name, indexCode: tracked }];
  });
}

/** 当前用户组合里出现过的 ETF 代码。未登录或读失败时为空。 */
export async function fetchHeldEtfCodes(client: SupabaseClient): Promise<Set<string>> {
  const { data: sessionData } = await client.auth.getSession();
  if (!sessionData.session) return new Set();
  const { data, error } = await client.from('grid_strategies').select('symbol');
  if (error || !data) return new Set();
  const codes = new Set<string>();
  for (const row of data) {
    const code = extractEtfCode(String(row.symbol ?? ''));
    if (code) codes.add(code);
  }
  return codes;
}
