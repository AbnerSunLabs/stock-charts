import type { SupabaseClient } from '@supabase/supabase-js';

import { isSettledAshareClose } from '@/lib/market/ashare-close';

/** index_daily_metrics 最新已收盘点位（只读） */
export interface IndexLatestClose {
  indexCode: string;
  tradeDate: string;
  close: number;
  previousClose: number | null;
}

interface MetricRow {
  index_code: unknown;
  trade_date: unknown;
  close: unknown;
  updated_at: unknown;
}

function parseClose(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function settledCloses(rows: MetricRow[]): Array<{ tradeDate: string; close: number }> {
  const picked: Array<{ tradeDate: string; close: number }> = [];
  for (const row of rows) {
    const close = parseClose(row.close);
    const tradeDate = String(row.trade_date ?? '').slice(0, 10);
    const updatedAt = String(row.updated_at ?? '');
    if (close == null || !isSettledAshareClose(tradeDate, updatedAt)) continue;
    picked.push({ tradeDate, close });
  }
  return picked;
}

/** 从按日期倒序的行里取出最新收盘和前一收盘。 */
export function pickLatestClose(indexCode: string, rows: MetricRow[]): IndexLatestClose | null {
  const settled = settledCloses(rows);
  const latest = settled[0];
  if (!latest) return null;
  return {
    indexCode,
    tradeDate: latest.tradeDate,
    close: latest.close,
    previousClose: settled[1]?.close ?? null,
  };
}

/**
 * 按指数代码各取最新已收盘点位。本仓只读共享表。
 */
export async function fetchLatestIndexCloses(
  client: SupabaseClient,
  indexCodes: string[]
): Promise<Map<string, IndexLatestClose>> {
  const unique = Array.from(new Set(indexCodes.filter(Boolean)));
  const result = new Map<string, IndexLatestClose>();
  if (unique.length === 0) return result;

  const rows = await Promise.all(
    unique.map(async code => {
      const { data, error } = await client
        .from('index_daily_metrics')
        .select('index_code, trade_date, close, updated_at')
        .eq('index_code', code)
        .order('trade_date', { ascending: false })
        .limit(8);
      if (error || !data) return null;
      return pickLatestClose(code, data);
    })
  );

  for (const row of rows) {
    if (row) result.set(row.indexCode, row);
  }
  return result;
}

const SERIES_PAGE = 1000;

/**
 * 读取一只指数的全部已收盘点位，按日期从早到晚。
 * 共享表只读；分页是为了越过接口默认的单页上限。
 */
export async function fetchIndexCloseSeries(
  client: SupabaseClient,
  indexCode: string
): Promise<Array<{ tradeDate: string; close: number }>> {
  const points: Array<{ tradeDate: string; close: number }> = [];
  for (let offset = 0; offset < 20000; offset += SERIES_PAGE) {
    const { data, error } = await client
      .from('index_daily_metrics')
      .select('trade_date, close, updated_at')
      .eq('index_code', indexCode)
      .not('close', 'is', null)
      .order('trade_date', { ascending: true })
      .range(offset, offset + SERIES_PAGE - 1);
    if (error) throw error;
    const rows = data ?? [];
    for (const row of rows) {
      const close = parseClose(row.close);
      const tradeDate = String(row.trade_date ?? '').slice(0, 10);
      const updatedAt = String(row.updated_at ?? '');
      if (close == null || !isSettledAshareClose(tradeDate, updatedAt)) continue;
      points.push({ tradeDate, close });
    }
    if (rows.length < SERIES_PAGE) break;
  }
  return points;
}
