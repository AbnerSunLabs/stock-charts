import type { SupabaseClient } from '@supabase/supabase-js';

import { isSettledAshareClose } from '@/lib/market/ashare-close';

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
        .select('etf_code, trade_date, close, updated_at')
        .eq('etf_code', code)
        .order('trade_date', { ascending: false })
        // 最近几根里跳过 15:00 前写入的盘中 K
        .limit(5);
      if (error || !data) return null;
      for (const row of data) {
        const close = parseClose(row.close);
        const tradeDate = String(row.trade_date ?? '').slice(0, 10);
        const updatedAt = String(row.updated_at ?? '');
        if (close == null || !isSettledAshareClose(tradeDate, updatedAt)) continue;
        return {
          etfCode: String(row.etf_code),
          tradeDate,
          close,
        };
      }
      return null;
    })
  );

  for (const row of rows) {
    if (row) result.set(row.etfCode, row);
  }
  return result;
}
