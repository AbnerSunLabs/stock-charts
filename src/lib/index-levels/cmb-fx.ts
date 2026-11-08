import type { IndexClosePoint } from '@/lib/index-levels/close-series';

/** 招行外汇历史牌价。公开接口，只读，不写入共享行情表。 */
const HISTORY_URL = 'https://fx.cmbchina.com/api/v1/fx/history-rate';

const SHANGHAI_DATE = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export interface CmbUsdQuotes {
  /** 现汇买入价，1 美元兑人民币。 */
  bid: IndexClosePoint[];
  /** 现汇卖出价，1 美元兑人民币。 */
  ask: IndexClosePoint[];
}

interface CmbFxRow {
  ratDat?: unknown;
  rthBid?: unknown;
  rthOfr?: unknown;
}

/**
 * 从招行历史牌价取出美元汇买、汇卖。
 * 源报价是 100 美元兑人民币，这里除以 100，收成 5 位小数。
 */
export function parseCmbUsdQuotes(rows: unknown): CmbUsdQuotes {
  const bid = new Map<string, number>();
  const ask = new Map<string, number>();
  if (!Array.isArray(rows)) return { bid: [], ask: [] };
  for (const row of rows) {
    if (!isCmbRow(row)) continue;
    const tradeDate = parseCmbDate(row.ratDat);
    if (!tradeDate) continue;
    const bidClose = perDollar(row.rthBid);
    const askClose = perDollar(row.rthOfr);
    if (bidClose != null) bid.set(tradeDate, bidClose);
    if (askClose != null) ask.set(tradeDate, askClose);
  }
  return { bid: toPoints(bid), ask: toPoints(ask) };
}

/** 拉取招行美元全部历史汇买、汇卖。当天按上海日期封顶。 */
export async function fetchCmbUsdQuotes(): Promise<CmbUsdQuotes> {
  const response = await fetch(HISTORY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Referer: 'https://fx.cmbchina.com/hq/History.aspx',
      'User-Agent': 'stock-charts',
    },
    body: JSON.stringify({
      nbr: '美元',
      startDate: '2009-01-01',
      endDate: SHANGHAI_DATE.format(new Date()),
    }),
    next: { revalidate: 60 * 60 },
  });
  if (!response.ok) throw new Error('cmb usd quotes failed');
  const payload = (await response.json()) as { returnCode?: string; body?: unknown };
  if (payload.returnCode !== 'SUC0000') throw new Error('cmb usd quotes rejected');
  return parseCmbUsdQuotes(payload.body);
}

function isCmbRow(value: unknown): value is CmbFxRow {
  return typeof value === 'object' && value != null;
}

function parseCmbDate(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const cn = raw.match(/^(\d{4})年(\d{2})月(\d{2})日/);
  if (cn) return `${cn[1]}-${cn[2]}-${cn[3]}`;
  return null;
}

/** 100 外币牌价折成 1 美元。 */
function perDollar(raw: unknown): number | null {
  const value = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : Number.NaN;
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round((value / 100) * 100000) / 100000;
}

function toPoints(series: Map<string, number>): IndexClosePoint[] {
  return Array.from(series.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([tradeDate, close]) => ({ tradeDate, close }));
}
