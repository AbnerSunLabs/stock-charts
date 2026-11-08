import type { IndexClosePoint } from '@/lib/index-levels/close-series';

/** 天天基金单位净值脚本。只读，不写入共享行情表。 */
const FUND_NAV_SCRIPTS: Record<string, string> = {
  '004752': 'https://fund.eastmoney.com/pingzhongdata/004752.js',
  '502010': 'https://fund.eastmoney.com/pingzhongdata/502010.js',
};

const SHANGHAI_DATE = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** 从 pingzhongdata 脚本取出单位净值。时间戳按上海日期。 */
export function parseFundNavScript(script: string): IndexClosePoint[] {
  const match = script.match(/Data_netWorthTrend\s*=\s*(\[[\s\S]*?\]);/);
  if (!match?.[1]) return [];
  const rows = JSON.parse(match[1]) as Array<{ x?: unknown; y?: unknown }>;
  if (!Array.isArray(rows)) return [];
  const points: IndexClosePoint[] = [];
  for (const row of rows) {
    const close = typeof row.y === 'number' ? row.y : Number(row.y);
    const ms = typeof row.x === 'number' ? row.x : Number(row.x);
    if (!Number.isFinite(close) || !Number.isFinite(ms)) continue;
    points.push({ tradeDate: SHANGHAI_DATE.format(new Date(ms)), close });
  }
  points.sort((a, b) => a.tradeDate.localeCompare(b.tradeDate));
  return points;
}

export function fundNavScriptUrl(code: string): string | null {
  return FUND_NAV_SCRIPTS[code] ?? null;
}

/** 拉取一只场外基金的全部单位净值。 */
export async function fetchFundNavSeries(code: string): Promise<IndexClosePoint[]> {
  const url = fundNavScriptUrl(code);
  if (!url) return [];
  const response = await fetch(url, {
    headers: {
      Referer: 'https://fund.eastmoney.com/',
      'User-Agent': 'stock-charts',
    },
    next: { revalidate: 60 * 60 },
  });
  if (!response.ok) throw new Error(`fund nav ${code} failed`);
  return parseFundNavScript(await response.text());
}
