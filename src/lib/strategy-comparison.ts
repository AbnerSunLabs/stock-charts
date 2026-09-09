import type { GridRow } from '@/types/grid';

/**
 * 策略对比图单个数据点：某一买入档位上「一次全仓死拿」与「本策略」的浮亏对比。
 */
export interface StrategyComparisonPoint {
  price: number;
  priceLabel: string;
  lumpSumFloatingLoss: number;
  lumpSumFloatingLossRate: number;
  gridFloatingLoss: number;
  gridFloatingLossRate: number;
  advantage: number;
  lumpSumBuyPrice: number;
  gridAverageCost: number;
  gridBuyAmount: number;
  gridBuyShares: number;
  gridBuyPrice: number;
  gridPosition: number;
}

/**
 * Tooltip 展示所需的派生指标。
 */
export interface StrategyTooltipMetrics {
  lumpSumDropRate: number;
  lumpSumLossAmount: number;
  lumpSumBreakEvenRise: number;
  gridDropRate: number;
  gridLossAmount: number;
  gridBreakEvenRise: number;
  lessLoss: number;
  breakEvenThreshold: number;
}

/**
 * 回本需涨幅 = 跌幅 / (1 - 跌幅)。跌幅 >= 100% 时无法回本，返回 Infinity。
 */
export function computeBreakEvenRise(dropRatePercent: number): number {
  const drop = dropRatePercent / 100;
  if (drop >= 1) return Number.POSITIVE_INFINITY;
  return (drop / (1 - drop)) * 100;
}

function formatPriceLabel(price: number, priceDecimals: number): string {
  return `¥${price.toFixed(priceDecimals)}`;
}

function toComparisonPoint(
  row: GridRow,
  clusterBuyAmount: number,
  clusterBuyShares: number,
  gridBoughtAmount: number,
  gridBoughtShares: number,
  totalBuyAmount: number,
  basePrice: number,
  priceDecimals: number
): StrategyComparisonPoint {
  const price = row.buyPrice;
  const lumpSumDropRate = ((basePrice - price) / basePrice) * 100;
  const lumpSumFloatingLoss = totalBuyAmount * (lumpSumDropRate / 100);
  const gridAverageCost = gridBoughtAmount / gridBoughtShares;
  const gridDropRate = ((basePrice - gridAverageCost) / basePrice) * 100;
  const gridFloatingLoss = gridBoughtAmount * (gridDropRate / 100);

  return {
    price,
    priceLabel: formatPriceLabel(price, priceDecimals),
    lumpSumFloatingLoss,
    lumpSumFloatingLossRate: -Math.abs(lumpSumDropRate),
    gridFloatingLoss,
    gridFloatingLossRate: -Math.abs(gridDropRate),
    advantage: lumpSumFloatingLoss - gridFloatingLoss,
    lumpSumBuyPrice: basePrice,
    gridAverageCost,
    gridBuyAmount: clusterBuyAmount,
    gridBuyShares: clusterBuyShares,
    gridBuyPrice: row.buyPrice,
    gridPosition: row.position,
  };
}

/**
 * 构建策略对比图数据：同展示价合并为一档（横轴等距、避免同价横盘），
 * 再逐档对比「一次全仓死拿」与「本策略」的浮亏。
 */
export function buildStrategyComparisonData(
  gridData: GridRow[],
  basePrice: number,
  priceDecimals: number
): StrategyComparisonPoint[] {
  if (gridData.length === 0 || basePrice <= 0) return [];

  const totalBuyAmount = gridData.reduce((sum, row) => sum + row.buyAmount, 0);
  const dataPoints: StrategyComparisonPoint[] = [];
  let gridBoughtAmount = 0;
  let gridBoughtShares = 0;
  let cluster: GridRow[] = [];
  let clusterLabel: string | null = null;

  const flushCluster = (): void => {
    if (cluster.length === 0) return;
    const clusterBuyAmount = cluster.reduce((sum, row) => sum + row.buyAmount, 0);
    const clusterBuyShares = cluster.reduce((sum, row) => sum + row.buyShares, 0);
    gridBoughtAmount += clusterBuyAmount;
    gridBoughtShares += clusterBuyShares;
    dataPoints.push(
      toComparisonPoint(
        cluster[cluster.length - 1],
        clusterBuyAmount,
        clusterBuyShares,
        gridBoughtAmount,
        gridBoughtShares,
        totalBuyAmount,
        basePrice,
        priceDecimals
      )
    );
    cluster = [];
  };

  for (const row of gridData) {
    if (row.buyShares <= 0) continue;
    const label = formatPriceLabel(row.buyPrice, priceDecimals);
    if (clusterLabel !== null && label !== clusterLabel) {
      flushCluster();
    }
    clusterLabel = label;
    cluster.push(row);
  }
  flushCluster();

  return dataPoints;
}

/**
 * 由数据点计算 Tooltip 派生指标（跌幅、回本需涨、少亏、回本门槛）。
 */
export function computeTooltipMetrics(
  point: StrategyComparisonPoint
): StrategyTooltipMetrics {
  const lumpSumDropRate =
    ((point.lumpSumBuyPrice - point.price) / point.lumpSumBuyPrice) * 100;
  const gridDropRate =
    ((point.lumpSumBuyPrice - point.gridAverageCost) / point.lumpSumBuyPrice) *
    100;

  return {
    lumpSumDropRate,
    lumpSumLossAmount: point.lumpSumFloatingLoss,
    lumpSumBreakEvenRise: computeBreakEvenRise(lumpSumDropRate),
    gridDropRate,
    gridLossAmount: point.gridFloatingLoss,
    gridBreakEvenRise: computeBreakEvenRise(gridDropRate),
    lessLoss: point.lumpSumFloatingLoss - point.gridFloatingLoss,
    breakEvenThreshold: lumpSumDropRate - gridDropRate,
  };
}
