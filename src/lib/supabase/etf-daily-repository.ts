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

interface EtfCloseRow {
  trade_date: unknown;
  close: unknown;
  updated_at: unknown;
}

const SERIES_PAGE = 1000;

/** 丢掉 15:00 前写入的盘中价。调用方按日期正序传入。 */
export function settledEtfClosePoints(
  rows: EtfCloseRow[]
): Array<{ tradeDate: string; close: number }> {
  const points: Array<{ tradeDate: string; close: number }> = [];
  for (const row of rows) {
    const close = parseClose(row.close);
    const tradeDate = String(row.trade_date ?? '').slice(0, 10);
    const updatedAt = String(row.updated_at ?? '');
    if (close == null || !isSettledAshareClose(tradeDate, updatedAt)) continue;
    points.push({ tradeDate, close });
  }
  return points;
}

/**
 * 读取一只 ETF 的全部已收盘，按日期从早到晚。
 * 共享表只读；分页是为了越过接口默认的单页上限。
 */
export async function fetchEtfCloseSeries(
  client: SupabaseClient,
  etfCode: string
): Promise<Array<{ tradeDate: string; close: number }>> {
  const points: Array<{ tradeDate: string; close: number }> = [];
  for (let offset = 0; offset < 20000; offset += SERIES_PAGE) {
    const page = await readEtfClosePage(client, etfCode, offset);
    points.push(...settledEtfClosePoints(page.rows));
    if (page.rows.length < SERIES_PAGE) break;
  }
  return points;
}

async function readEtfClosePage(
  client: SupabaseClient,
  etfCode: string,
  offset: number
): Promise<{ rows: EtfCloseRow[] }> {
  const { data, error } = await client
    .from('etf_daily')
    .select('trade_date, close, updated_at')
    .eq('etf_code', etfCode)
    .not('close', 'is', null)
    .order('trade_date', { ascending: true })
    .range(offset, offset + SERIES_PAGE - 1);
  if (error) throw error;
  return { rows: data ?? [] };
}
