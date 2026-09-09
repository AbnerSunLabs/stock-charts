import type { GridStrategyTrade } from '@/types/grid-strategy-trade';

/** 单档持仓与轮次 */
export interface LevelTradeQty {
  openQty: number;
  rounds: number;
  occupiedCost: number;
}

/** 单策略流水汇总 */
export interface StrategyTradeStats {
  openLevels: number;
  totalLevels: number;
  rounds: number;
  occupied: number;
  realized: number;
  openShares: number;
}

function sortTrades(trades: GridStrategyTrade[]): GridStrategyTrade[] {
  return [...trades].sort((a, b) => {
    const byCreated = a.createdAt.localeCompare(b.createdAt);
    if (byCreated !== 0) return byCreated;
    return a.id.localeCompare(b.id);
  });
}

/**
 * 按时间序计算单档 openQty / 轮次 / 占用成本。
 */
export function computeLevelTradeQty(trades: GridStrategyTrade[]): LevelTradeQty {
  const ordered = sortTrades(trades);
  let openQty = 0;
  let rounds = 0;
  let occupiedCost = 0;
  const lots: { qty: number; price: number }[] = [];

  for (const t of ordered) {
    if (t.side === 'buy') {
      openQty += t.qty;
      occupiedCost += t.price * t.qty;
      lots.push({ qty: t.qty, price: t.price });
      continue;
    }
    let remain = t.qty;
    rounds += 1;
    openQty -= t.qty;
    while (remain > 0 && lots.length > 0) {
      const lot = lots[0];
      const take = Math.min(lot.qty, remain);
      occupiedCost -= lot.price * take;
      lot.qty -= take;
      remain -= take;
      if (lot.qty === 0) lots.shift();
    }
  }

  return {
    openQty: Math.max(0, openQty),
    rounds,
    occupiedCost: Math.max(0, occupiedCost),
  };
}

/**
 * 卖出 FIFO 已实现盈亏；买入返回 null。
 */
export function computeSellRealizedPnl(
  allTrades: GridStrategyTrade[],
  sellTrade: GridStrategyTrade
): number | null {
  if (sellTrade.side !== 'sell') return null;
  const levelTrades = sortTrades(
    allTrades.filter(t => t.levelKey === sellTrade.levelKey)
  );
  const lots: { qty: number; price: number }[] = [];
  let pnl = 0;
  let found = false;

  for (const t of levelTrades) {
    if (t.side === 'buy') {
      lots.push({ qty: t.qty, price: t.price });
      continue;
    }
    let remain = t.qty;
    let matchedCost = 0;
    let matchedQty = 0;
    while (remain > 0 && lots.length > 0) {
      const lot = lots[0];
      const take = Math.min(lot.qty, remain);
      matchedCost += lot.price * take;
      matchedQty += take;
      lot.qty -= take;
      remain -= take;
      if (lot.qty === 0) lots.shift();
    }
    if (t.id === sellTrade.id) {
      found = true;
      pnl = sellTrade.price * matchedQty - matchedCost;
      break;
    }
  }

  return found ? pnl : 0;
}

/**
 * 写入前校验：卖出后 openQty 不得为负。
 */
export function assertSellWithinOpenQty(
  existing: GridStrategyTrade[],
  levelKey: string,
  sellQty: number
): void {
  const level = existing.filter(t => t.levelKey === levelKey);
  const { openQty } = computeLevelTradeQty(level);
  if (sellQty > openQty) {
    throw new Error(`卖出股数不能超过持仓 ${openQty}`);
  }
}

/**
 * 汇总策略流水与档位列表。
 */
export function computeStrategyTradeStats(
  trades: GridStrategyTrade[],
  levelKeys: string[]
): StrategyTradeStats {
  const byLevel = new Map<string, GridStrategyTrade[]>();
  for (const t of trades) {
    const list = byLevel.get(t.levelKey) ?? [];
    list.push(t);
    byLevel.set(t.levelKey, list);
  }

  let openLevels = 0;
  let rounds = 0;
  let occupied = 0;
  let realized = 0;
  let openShares = 0;

  const keys =
    levelKeys.length > 0
      ? Array.from(new Set(levelKeys.concat(Array.from(byLevel.keys()))))
      : Array.from(byLevel.keys());
  for (const key of keys) {
    const list = byLevel.get(key) ?? [];
    const q = computeLevelTradeQty(list);
    if (q.openQty > 0) openLevels += 1;
    rounds += q.rounds;
    occupied += q.occupiedCost;
    openShares += q.openQty;
  }

  for (const t of trades) {
    if (t.side !== 'sell') continue;
    const pnl = computeSellRealizedPnl(trades, t);
    if (pnl != null) realized += pnl;
  }

  return {
    openLevels,
    totalLevels: levelKeys.length > 0 ? levelKeys.length : byLevel.size,
    rounds,
    occupied,
    realized,
    openShares,
  };
}

/**
 * 预计最大亏损粗估：全仓买入后按最低价计残值。
 */
export function estimateMaxLoss(
  totalBuyAmount: number,
  remainingShares: number,
  minPrice: number
): number {
  return Math.max(0, totalBuyAmount - remainingShares * minPrice);
}
