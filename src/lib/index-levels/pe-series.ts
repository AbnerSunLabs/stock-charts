import type { IndexClosePoint } from "@/lib/index-levels/close-series";

/** 某一天的滚动市盈率（PE-TTM）。 */
export interface PePoint {
  tradeDate: string;
  peTtm: number;
}

/** 官网的非正数占位不能参与估值曲线和统计，库内数据也遵守同一规则。 */
export function isValidPeTtm(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

/** 悬停日相对当时已有序列的分位、均值和偏离。 */
export interface PeHoverStats {
  peTtm: number;
  historyRank: number;
  fiveYearRank: number;
  tenYearRank: number;
  fiveYearMean: number;
  tenYearMean: number;
  fiveYearGap: number;
  tenYearGap: number;
}

/** 中证官网用的指数代码。恒生、标普、汇率不在这套接口里。 */
export function csindexSymbol(code: string): string | null {
  const match = /^([0-9A-Z]+)\.(SH|SZ|CSI)$/.exec(code);
  return match?.[1] ?? null;
}

/** 把市盈率按交易日贴到已有收盘上。库里已有的值保留。 */
export function mergePe(
  points: IndexClosePoint[],
  pe: readonly PePoint[],
): IndexClosePoint[] {
  const byDate = new Map(pe.map((point) => [point.tradeDate, point.peTtm]));
  return points.map((point) => {
    if (isValidPeTtm(point.peTtm)) return point;
    const peTtm = byDate.get(point.tradeDate);
    return isValidPeTtm(peTtm) ? { ...point, peTtm } : point;
  });
}

/**
 * 悬停日的估值位置。
 * 历史分位用该日及之前的全部市盈率；五年、十年按日期往前切，不看当前图表窗口。
 */
export function peHoverStats(
  history: readonly PePoint[],
  tradeDate: string,
): PeHoverStats | null {
  const current = history.find((point) => point.tradeDate === tradeDate);
  if (!current || !isValidPeTtm(current.peTtm)) return null;
  const until = history.filter(
    point => point.tradeDate <= tradeDate && isValidPeTtm(point.peTtm),
  );
  const five = until.filter(
    (point) => point.tradeDate >= yearsBefore(tradeDate, 5),
  );
  const ten = until.filter(
    (point) => point.tradeDate >= yearsBefore(tradeDate, 10),
  );
  const fiveValues = five.map((point) => point.peTtm);
  const tenValues = ten.map((point) => point.peTtm);
  const fiveMean = average(fiveValues);
  const tenMean = average(tenValues);
  return {
    peTtm: current.peTtm,
    historyRank: percentile(
      until.map((point) => point.peTtm),
      current.peTtm,
    ),
    fiveYearRank: percentile(fiveValues, current.peTtm),
    tenYearRank: percentile(tenValues, current.peTtm),
    fiveYearMean: fiveMean,
    tenYearMean: tenMean,
    fiveYearGap: gapPercent(current.peTtm, fiveMean),
    tenYearGap: gapPercent(current.peTtm, tenMean),
  };
}

/** 按交易日补齐缺失或无效的市盈率。官网失败时保留库内已有序列。 */
export async function attachIndexPe(
  code: string,
  series: IndexClosePoint[],
): Promise<IndexClosePoint[]> {
  if (series.every(point => isValidPeTtm(point.peTtm)) || !csindexSymbol(code))
    return series;
  try {
    const response = await fetch(
      `/api/index-levels/pe?code=${encodeURIComponent(code)}`,
    );
    if (!response.ok) return series;
    const body = (await response.json()) as { points?: unknown };
    return mergePe(series, asPePoints(body.points));
  } catch {
    return series;
  }
}

/** 中证 index-perf 的 data 行。peg 是滚动市盈率。 */
export function parseCsindexPe(payload: unknown): PePoint[] {
  if (!payload || typeof payload !== "object") return [];
  const data = (payload as { data?: unknown }).data;
  if (!Array.isArray(data)) return [];
  const points: PePoint[] = [];
  for (const row of data) {
    const point = readCsindexRow(row);
    if (point) points.push(point);
  }
  points.sort((left, right) => left.tradeDate.localeCompare(right.tradeDate));
  return points;
}

function readCsindexRow(row: unknown): PePoint | null {
  if (!row || typeof row !== "object") return null;
  const item = row as { tradeDate?: unknown; peg?: unknown };
  const raw = String(item.tradeDate ?? "");
  const peTtm = typeof item.peg === "number" ? item.peg : Number(item.peg);
  if (!/^\d{8}$/.test(raw) || !isValidPeTtm(peTtm))
    return null;
  return {
    tradeDate: `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`,
    peTtm,
  };
}

function asPePoints(value: unknown): PePoint[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as { tradeDate?: unknown; peTtm?: unknown };
    const tradeDate = String(row.tradeDate ?? "");
    const peTtm = typeof row.peTtm === "number" ? row.peTtm : Number(row.peTtm);
    // 0 是中证官网在尚无盈利时的占位，不当作估值。
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(tradeDate) ||
      !isValidPeTtm(peTtm)
    )
      return [];
    return [{ tradeDate, peTtm }];
  });
}

function yearsBefore(iso: string, years: number): string {
  const [year, month, day] = iso.split("-");
  return `${Number(year) - years}-${month}-${day}`;
}

function percentile(values: number[], current: number): number {
  if (values.length === 0) return 0;
  const count = values.reduce(
    (sum, value) => sum + (value <= current ? 1 : 0),
    0,
  );
  return (count / values.length) * 100;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function gapPercent(value: number, base: number): number {
  if (!Number.isFinite(base) || base === 0) return 0;
  return (value / base - 1) * 100;
}
