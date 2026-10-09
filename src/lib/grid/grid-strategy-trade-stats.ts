import { calculateCommission } from '@/lib/grid/trade-cost';
import type { StressTest } from '@/types/grid';
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

/** 执行列：上一笔是买入则待卖，否则可再买（留利底仓不挡住下一轮） */
export interface LevelExecuteState extends LevelTradeQty {
  awaitingSell: boolean;
}

/**
 * 执行列状态：循环买卖看最后一笔方向，不把留利底仓当成「必须先卖完」。
 */
export function getLevelExecuteState(
  trades: GridStrategyTrade[]
): LevelExecuteState {
  const qty = computeLevelTradeQty(trades);
  const ordered = sortTrades(trades);
  const last = ordered[ordered.length - 1];
  return {
    ...qty,
    awaitingSell: last?.side === 'buy',
  };
}

/**
 * 卖出默认股数：先按计划卖出份额，不超过当前持仓。
 */
export function defaultSellQty(
  openQty: number,
  plannedSellShares: number
): number {
  if (plannedSellShares > 0) {
    return Math.min(openQty, plannedSellShares);
  }
  return openQty;
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
 * `openLevels` 只统计当前快照中「上一笔是买入」的档（与结果表「持仓中」相同）；
 * 留利底仓、失效档不进 a。占用、轮次、股数仍计入失效档与底仓。
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

  const currentKeys = new Set(levelKeys);
  const keys =
    levelKeys.length > 0
      ? Array.from(new Set(levelKeys.concat(Array.from(byLevel.keys()))))
      : Array.from(byLevel.keys());
  for (const key of keys) {
    const list = byLevel.get(key) ?? [];
    const q = getLevelExecuteState(list);
    // a = 当前快照里上一笔是买的档；与结果表「持仓中」一致
    if (q.awaitingSell && (levelKeys.length === 0 || currentKeys.has(key))) {
      openLevels += 1;
    }
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

/** 摊薄成本用的费率。成交价已是流水成交价，不含计划滑点。 */
export interface DilutedCostRates {
  buyCommissionRate: number;
  sellCommissionRate: number;
  minCommission: number;
  stampDutyRate: number;
  transferFeeRate: number;
}

/** 当前策略未平仓报价：市值、持仓股数、摊薄成本价 */
export interface OpenPositionQuote {
  marketValue: number | null;
  openShares: number;
  costPrice: number | null;
}

/**
 * 券商摊薄成本价：（累计买入金额 + 买入佣金 − 累计卖出金额 + 卖出费用）÷ 持仓。
 * 卖出费用含佣金、印花税、过户费。没有持仓时返回 null。
 */
export function computeDilutedCostPrice(
  trades: GridStrategyTrade[],
  openShares: number,
  rates: DilutedCostRates
): number | null {
  if (openShares <= 0) return null;
  let netCash = 0;
  for (const t of trades) {
    const amount = t.price * t.qty;
    if (t.side === 'buy') {
      netCash +=
        amount +
        calculateCommission(
          t.price,
          t.qty,
          rates.buyCommissionRate,
          rates.minCommission
        );
      continue;
    }
    const sellFee =
      calculateCommission(
        t.price,
        t.qty,
        rates.sellCommissionRate,
        rates.minCommission
      ) + amount * (rates.stampDutyRate + rates.transferFeeRate);
    netCash -= amount - sellFee;
  }
  return netCash / openShares;
}

/**
 * 由流水未平仓与最新收盘得到持仓报价。
 * 没有持仓时三个数都空；有持仓但没有收盘时只缺市值。
 */
export function computeOpenPositionQuote(
  stats: Pick<StrategyTradeStats, 'openShares'>,
  close: number | null,
  trades: GridStrategyTrade[],
  rates: DilutedCostRates
): OpenPositionQuote {
  if (stats.openShares <= 0) {
    return { marketValue: null, openShares: 0, costPrice: null };
  }
  return {
    marketValue: close == null ? null : close * stats.openShares,
    openShares: stats.openShares,
    costPrice: computeDilutedCostPrice(trades, stats.openShares, rates),
  };
}

/**
 * 看板最新收益：已平仓 FIFO 盈亏 + 未平仓按最新收盘价盯市。
 * 无收盘价或没有未平股数时，只返回已平仓盈亏。
 */
export function computeLatestProfit(
  stats: Pick<StrategyTradeStats, 'realized' | 'openShares' | 'occupied'>,
  close: number | null
): number {
  if (close == null || stats.openShares <= 0) return stats.realized;
  return stats.realized + close * stats.openShares - stats.occupied;
}

/**
 * 预计最大亏损：全仓按计划买齐后，股价跌到最低价的残值差。
 * `shares` 必须是计划买入总股数，不能用留利底仓。
 */
export function estimateMaxLoss(
  totalBuyAmount: number,
  shares: number,
  minPrice: number
): number {
  return Math.max(0, totalBuyAmount - shares * minPrice);
}

/**
 * 用最新保存快照的投入与买入股数，配保存配置里的最低价。
 */
export function estimateMaxLossFromSnapshot(
  stress: StressTest | null | undefined,
  minPrice: number
): number {
  if (!stress) return 0;
  const totalBuy = stress.v2?.totalBudgetRequired ?? stress.totalBuyAmount;
  const shares = stress.v2?.totalBuyShares ?? stress.totalBuyShares;
  return estimateMaxLoss(totalBuy, shares, minPrice);
}
