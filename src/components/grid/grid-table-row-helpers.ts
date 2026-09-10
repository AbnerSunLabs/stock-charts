import type { GridRow, GridType } from '@/types/grid';
import type { GridLeg, GridLayerLabel } from '@/types/grid-v2';

export const GRID_TYPE_META = {
  小网: 'bg-[color-mix(in_srgb,var(--muted-foreground)_12%,var(--card))] text-[var(--foreground)] ring-1 ring-[var(--border)]',
  中网: 'bg-[color-mix(in_srgb,var(--accent)_9%,var(--card))] text-[var(--foreground)] ring-1 ring-[color-mix(in_srgb,var(--accent)_22%,var(--border))]',
  大网: 'bg-[color-mix(in_srgb,var(--accent)_15%,var(--card))] text-[var(--foreground)] ring-1 ring-[color-mix(in_srgb,var(--accent)_30%,var(--border))]',
} satisfies Record<GridType, string>;

export function getGridRowKey(row: GridRow): string {
  return [
    row.gridType,
    row.position,
    row.buyPrice,
    row.sellPrice,
    row.buyShares,
    row.sellShares,
  ].join('-');
}

/**
 * 将 legs 转为 legId -> GridRow 映射（跌幅口径与明细表一致）。
 */
export function buildLegGridRowMap(
  legs: GridLeg[],
  basePrice: number
): Map<string, GridRow> {
  const map = new Map<string, GridRow>();
  const lastByLayer = new Map<GridLayerLabel, number>();
  const sorted = [...legs].sort((a, b) => b.buyPrice - a.buyPrice);

  sorted.forEach(leg => {
    const layerKey = leg.gridLabel;
    const prevPrice = lastByLayer.get(layerKey);
    let priceDropRate = 0;

    if (prevPrice !== undefined) {
      priceDropRate = ((leg.buyPrice - prevPrice) / prevPrice) * 100;
    } else if (leg.gridLabel === '中网' || leg.gridLabel === '大网') {
      priceDropRate = ((basePrice - leg.buyPrice) / basePrice) * 100;
    }

    lastByLayer.set(layerKey, leg.buyPrice);

    map.set(leg.id, {
      position: parseFloat(leg.positionRatio.toFixed(2)),
      buyTriggerPrice: leg.buyExecutionPrice,
      buyPrice: leg.buyPrice,
      buyAmount: leg.actualBuyAmount,
      buyShares: leg.buyShares,
      sellTriggerPrice: leg.sellExecutionPrice,
      sellPrice: leg.sellPrice,
      sellShares: leg.sellShares,
      sellAmount: leg.sellAmount,
      priceDropRate: parseFloat(priceDropRate.toFixed(2)),
      gridType: leg.gridLabel as GridType,
    });
  });

  return map;
}

/**
 * 计算每层首档 position，用于跌幅展示。
 */
export function buildFirstPositionByType(
  legs: GridLeg[]
): Map<GridLayerLabel, number> {
  const firstByType = new Map<GridLayerLabel, number>();
  const sorted = [...legs].sort((a, b) => b.positionRatio - a.positionRatio);
  sorted.forEach(leg => {
    if (!firstByType.has(leg.gridLabel)) {
      firstByType.set(leg.gridLabel, parseFloat(leg.positionRatio.toFixed(2)));
    }
  });
  return firstByType;
}

/**
 * 计算跌幅展示值。
 */
export function getDisplayDropRate(
  row: GridRow,
  firstPositionByType: Map<string, number>
): number {
  const isFirstPosition =
    (row.gridType === '中网' || row.gridType === '大网') &&
    firstPositionByType.get(row.gridType) === row.position;

  if (isFirstPosition && row.priceDropRate > 0) {
    return -row.priceDropRate;
  }
  return row.priceDropRate;
}

/** 组合行卖出股数 / 卖出金额：子档合计（与明细行同一 `sellAmount` 口径）。 */
export function sumChildSellStats(
  childLegIds: string[],
  legRowMap: Map<string, GridRow>
): { sellShares: number; sellAmount: number } {
  return childLegIds.reduce(
    (acc, id) => {
      const row = legRowMap.get(id);
      if (!row) return acc;
      return {
        sellShares: acc.sellShares + row.sellShares,
        sellAmount: acc.sellAmount + row.sellAmount,
      };
    },
    { sellShares: 0, sellAmount: 0 }
  );
}
