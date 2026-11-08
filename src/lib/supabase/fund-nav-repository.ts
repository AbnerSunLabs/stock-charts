import type { SupabaseClient } from '@supabase/supabase-js';

import type { IndexClosePoint } from '@/lib/index-levels/close-series';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';

/** 已由定时任务落库的场外基金。 */
export const STORED_FUND_CODES: ReadonlySet<string> = new Set(['004752', '502010']);

const SERIES_PAGE = 1000;

interface FundNavRow {
  nav_date: unknown;
  unit_nav: unknown;
}

function parseNav(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
  if (typeof value === 'string') {
    const nav = Number(value);
    return Number.isFinite(nav) && nav > 0 ? nav : null;
  }
  return null;
}

/** 把共享表行映射成折线点。非法净值丢掉。 */
export function toFundNavPoints(rows: FundNavRow[]): IndexClosePoint[] {
  const points: IndexClosePoint[] = [];
  for (const row of rows) {
    const close = parseNav(row.unit_nav);
    const tradeDate = String(row.nav_date ?? '').slice(0, 10);
    if (close == null || !/^\d{4}-\d{2}-\d{2}$/.test(tradeDate)) continue;
    points.push({ tradeDate, close });
  }
  return points;
}

/**
 * 读取一只场外基金的全部已落库单位净值，按日期从早到晚。
 * 共享表只读。
 */
export async function fetchStoredFundNavSeries(
  client: SupabaseClient,
  fundCode: string
): Promise<IndexClosePoint[]> {
  const points: IndexClosePoint[] = [];
  for (let offset = 0; offset < 20000; offset += SERIES_PAGE) {
    const rows = await readFundNavPage(client, fundCode, offset);
    points.push(...toFundNavPoints(rows));
    if (rows.length < SERIES_PAGE) break;
  }
  return points;
}

async function readFundNavPage(client: SupabaseClient, fundCode: string, offset: number): Promise<FundNavRow[]> {
  const { data, error } = await client
    .from('fund_nav_daily')
    .select('nav_date, unit_nav')
    .eq('fund_code', fundCode)
    .order('nav_date', { ascending: true })
    .range(offset, offset + SERIES_PAGE - 1);
  if (error) throw error;
  return data ?? [];
}

/** 已落库的场外基金优先读共享表。表还没有数据时回到天天基金接口。 */
export async function loadChartFundNav(code: string): Promise<IndexClosePoint[]> {
  if (STORED_FUND_CODES.has(code)) {
    const stored = await readStoredOrEmpty(code);
    if (stored.length > 0) return stored;
  }
  return fetchLiveFundNav(code);
}

async function readStoredOrEmpty(code: string): Promise<IndexClosePoint[]> {
  try {
    return await fetchStoredFundNavSeries(createBrowserSupabaseClient(), code);
  } catch {
    return [];
  }
}

async function fetchLiveFundNav(code: string): Promise<IndexClosePoint[]> {
  const response = await fetch(`/api/index-levels/fund-nav?code=${code}`);
  if (!response.ok) throw new Error('fund nav failed');
  const body = (await response.json()) as { points?: IndexClosePoint[] };
  return body.points ?? [];
}
