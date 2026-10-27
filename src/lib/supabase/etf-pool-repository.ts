import type { SupabaseClient } from '@supabase/supabase-js';

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
