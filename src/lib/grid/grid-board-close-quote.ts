import { formatGridPrice } from '@/lib/grid/format-grid-amount';
import { getLevelExecuteState } from '@/lib/grid/grid-strategy-trade-stats';
import type { GridStrategyTrade } from '@/types/grid-strategy-trade';

/** 看板对比用的一档计划价与持仓态 */
export interface BoardQuoteLevel {
  levelKey: string;
  buyPrice: number;
  sellPrice: number;
  awaitingSell: boolean;
}

export type CloseDistanceKind = 'down' | 'up' | 'flat';

/**
 * 策略标的转 etf_daily 代码：开头 6 位数字。
 */
export function extractEtfCode(symbol: string): string | null {
  const match = symbol.trim().match(/^(\d{6})/);
  return match ? match[1] : null;
}

/**
 * 交易日 YYYY-MM-DD → 卡片用 MM-DD。
 */
export function formatCloseMonthDay(tradeDate: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tradeDate)) return tradeDate;
  return tradeDate.slice(5);
}

/**
 * 未买档里买入价离收盘绝对值最近的计划买价。
 */
export function pickNearestUnboughtBuyPrice(
  close: number,
  levels: BoardQuoteLevel[]
): number | null {
  const open = levels.filter(l => !l.awaitingSell);
  if (open.length === 0) return null;
  return open.reduce((best, l) =>
    Math.abs(l.buyPrice - close) < Math.abs(best.buyPrice - close) ? l : best
  ).buyPrice;
}

function lastBuyCreatedAt(
  trades: GridStrategyTrade[],
  levelKey: string
): string | null {
  let latest: string | null = null;
  for (const t of trades) {
    if (t.levelKey !== levelKey || t.side !== 'buy') continue;
    if (latest == null || t.createdAt.localeCompare(latest) > 0) {
      latest = t.createdAt;
    }
  }
  return latest;
}

/**
 * 待卖档：最后买入的那档计划卖价；无买入时间则买入价最低的一档。
 */
export function pickLatestAwaitingSellPrice(
  levels: BoardQuoteLevel[],
  trades: GridStrategyTrade[]
): number | null {
  const held = levels.filter(l => l.awaitingSell);
  if (held.length === 0) return null;

  let bestDated: BoardQuoteLevel | null = null;
  let bestTime = '';
  for (const l of held) {
    const t = lastBuyCreatedAt(trades, l.levelKey);
    if (t != null && t.localeCompare(bestTime) > 0) {
      bestDated = l;
      bestTime = t;
    }
  }
  if (bestDated) return bestDated.sellPrice;

  return held.reduce((a, b) => (a.buyPrice <= b.buyPrice ? a : b)).sellPrice;
}

/**
 * 收盘相对锚定价：高于再跌、低于再涨。
 */
export function compareCloseToAnchor(
  close: number,
  anchor: number
): { kind: CloseDistanceKind; pct: number } {
  const delta = close - anchor;
  if (Math.abs(delta) < 1e-12) {
    return { kind: 'flat', pct: 0 };
  }
  if (delta > 0) {
    return { kind: 'down', pct: delta / close };
  }
  return { kind: 'up', pct: -delta / close };
}

/**
 * 距离百分比：一位小数。
 */
export function formatDistancePct(ratio: number): string {
  return `${(Math.round(ratio * 1000) / 10).toFixed(1)}%`;
}

/**
 * 快照档 + 流水 → 看板对比用档位。
 */
export function buildBoardQuoteLevels(
  legs: { id: string; buyPrice: number; sellPrice: number }[],
  trades: GridStrategyTrade[]
): BoardQuoteLevel[] {
  return legs.map(leg => ({
    levelKey: leg.id,
    buyPrice: leg.buyPrice,
    sellPrice: leg.sellPrice,
    awaitingSell: getLevelExecuteState(
      trades.filter(t => t.levelKey === leg.id)
    ).awaitingSell,
  }));
}

export type BoardDistanceView = {
  main: string;
  sub: string;
  tone: 'drop' | 'rise' | 'flat' | 'empty';
};

/**
 * 下一买 / 下一卖单元格文案。
 */
export function describeBoardDistance(
  close: number | null,
  anchor: number | null,
  priceUnit: number
): BoardDistanceView {
  if (close == null || anchor == null) {
    return { main: '—', sub: '', tone: 'empty' };
  }
  const { kind, pct } = compareCloseToAnchor(close, anchor);
  const sub = formatGridPrice(anchor, priceUnit);
  if (kind === 'flat') return { main: '已到位', sub, tone: 'flat' };
  if (kind === 'down') {
    return { main: `再跌 ${formatDistancePct(pct)}`, sub, tone: 'drop' };
  }
  return { main: `再涨 ${formatDistancePct(pct)}`, sub, tone: 'rise' };
}
