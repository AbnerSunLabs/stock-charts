import type { SupabaseClient } from '@supabase/supabase-js';

/** etf_daily 最新收盘（只读） */
export interface EtfLatestClose {
  etfCode: string;
  tradeDate: string;
  close: number;
}

function parseClose(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * 按代码各取最新交易日收盘。本仓只读共享行情表。
 */
export async function fetchLatestEtfCloses(
  client: SupabaseClient,
  etfCodes: string[]
): Promise<Map<string, EtfLatestClose>> {
  const unique = Array.from(new Set(etfCodes.filter(Boolean)));
  const result = new Map<string, EtfLatestClose>();
  if (unique.length === 0) return result;

  const rows = await Promise.all(
    unique.map(async code => {
      const { data, error } = await client
        .from('etf_daily')
        .select('etf_code, trade_date, close')
        .eq('etf_code', code)
        .order('trade_date', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error || !data) return null;
      const close = parseClose(data.close);
      const tradeDate = String(data.trade_date ?? '').slice(0, 10);
      if (close == null || !/^\d{4}-\d{2}-\d{2}$/.test(tradeDate)) return null;
      return {
        etfCode: String(data.etf_code),
        tradeDate,
        close,
      };
    })
  );

  for (const row of rows) {
    if (row) result.set(row.etfCode, row);
  }
  return result;
}
