import {
  csindexSymbol,
  parseCsindexPe,
  type PePoint,
} from "@/lib/index-levels/pe-series";

/** 只读中证官网。结果给页面画线，不写入共享行情表。 */
const PE_START_YEAR = 2005;
const YEAR_BATCH = 4;
const CACHE_MS = 6 * 60 * 60 * 1000;

const cache = new Map<string, { at: number; points: PePoint[] }>();

/** 一只指数自 2005 年起的滚动市盈率。官网按年分页，避免一次拉完全部历史。 */
export async function fetchCsindexPe(indexCode: string): Promise<PePoint[]> {
  const symbol = csindexSymbol(indexCode);
  if (!symbol) return [];
  const hit = cache.get(symbol);
  if (hit && Date.now() - hit.at < CACHE_MS) return positive(hit.points);
  const points = positive(dedupe(await fetchYears(symbol)));
  if (points.length > 0) cache.set(symbol, { at: Date.now(), points });
  return points;
}

async function fetchYears(symbol: string): Promise<PePoint[]> {
  const end = new Date().getFullYear();
  const years: number[] = [];
  for (let year = PE_START_YEAR; year <= end; year += 1) years.push(year);
  const points: PePoint[] = [];
  for (let offset = 0; offset < years.length; offset += YEAR_BATCH) {
    const pages = await Promise.all(
      years
        .slice(offset, offset + YEAR_BATCH)
        .map((year) => fetchYear(symbol, year)),
    );
    pages.forEach((page) => points.push(...page));
  }
  return points;
}

async function fetchYear(symbol: string, year: number): Promise<PePoint[]> {
  const url =
    `https://www.csindex.com.cn/csindex-home/perf/index-perf` +
    `?indexCode=${symbol}&startDate=${year}0101&endDate=${year}1231`;
  const response = await fetch(url, {
    headers: {
      Referer: "https://www.csindex.com.cn/",
      "User-Agent": "stock-charts",
    },
    // 只缓存完整且校验成功的汇总，避免异常年度回包被底层缓存六小时。
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`中证市盈率请求失败：${response.status}`);
  }
  const payload: unknown = await response.json();
  if (
    !payload ||
    typeof payload !== "object" ||
    !Array.isArray((payload as { data?: unknown }).data)
  ) {
    throw new Error("中证市盈率回包缺少年度数据");
  }
  return parseCsindexPe(payload);
}

/** 官网在指数还没有盈利时用 0 占位。留着会把右轴压到地上，分位也会被垫高。 */
function positive(points: PePoint[]): PePoint[] {
  return points.filter((point) => point.peTtm > 0);
}

function dedupe(points: PePoint[]): PePoint[] {
  const byDate = new Map<string, number>();
  points.forEach((point) => byDate.set(point.tradeDate, point.peTtm));
  const unique: PePoint[] = [];
  byDate.forEach((peTtm, tradeDate) => unique.push({ tradeDate, peTtm }));
  unique.sort((left, right) => left.tradeDate.localeCompare(right.tradeDate));
  return unique;
}
