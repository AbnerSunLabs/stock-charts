import {
  buildFirstPositionByType,
  buildLegGridRowMap,
  getDisplayDropRate,
  sumChildSellStats,
} from '@/components/grid/grid-table-row-helpers';
import type { GridRow } from '@/types/grid';
import type { GridLeg } from '@/types/grid-v2';

function buildLeg(
  id: string,
  gridLabel: GridLeg['gridLabel'],
  buyPrice: number,
  positionRatio: number
): GridLeg {
  return {
    id,
    gridType:
      gridLabel === '小网' ? 'small' : gridLabel === '中网' ? 'medium' : 'large',
    gridLabel,
    indexInLayer: 0,
    buyPrice,
    buyExecutionPrice: buyPrice,
    sellPrice: buyPrice * 1.05,
    sellExecutionPrice: buyPrice * 1.05,
    effectiveStepRatio: 0.05,
    positionRatio,
    amountWeight: 1,
    plannedBuyAmount: 10000,
    buyShares: 100,
    actualBuyAmount: buyPrice * 100,
    buyCommission: 0,
    sellShares: 100,
    reservedShares: 0,
    sellAmount: buyPrice * 100,
    sellCommission: 0,
    gridNetProfit: 0,
    reserveCost: 0,
    isBottomGrid: false,
  };
}

describe('grid-table-row-helpers', () => {
  it('buildLegGridRowMap 应按层计算跌幅', () => {
    const legs = [
      buildLeg('small-high', '小网', 1.0, 1),
      buildLeg('small-low', '小网', 0.95, 0.95),
      buildLeg('medium-first', '中网', 0.85, 0.5),
    ];
    const map = buildLegGridRowMap(legs, 1.0);
    const smallLow = map.get('small-low');

    expect(smallLow?.priceDropRate).toBeCloseTo(-5, 1);
    expect(map.get('medium-first')?.priceDropRate).toBeCloseTo(15, 0);
  });

  it('getDisplayDropRate 应将中网/大网首档正跌幅展示为负值', () => {
    const row: GridRow = {
      position: 0.52,
      buyTriggerPrice: 0.521,
      buyPrice: 0.521,
      buyAmount: 1000,
      buyShares: 100,
      sellTriggerPrice: 0.55,
      sellPrice: 0.55,
      sellShares: 100,
      sellAmount: 1100,
      priceDropRate: 15.01,
      gridType: '中网',
    };
    const firstByType = new Map<string, number>([['中网', 0.52]]);

    expect(getDisplayDropRate(row, firstByType)).toBeCloseTo(-15.01, 2);
  });

  it('getDisplayDropRate 非首档应保持原跌幅', () => {
    const row: GridRow = {
      position: 0.44,
      buyTriggerPrice: 0.442,
      buyPrice: 0.442,
      buyAmount: 1000,
      buyShares: 100,
      sellTriggerPrice: 0.5,
      sellPrice: 0.5,
      sellShares: 100,
      sellAmount: 1100,
      priceDropRate: -15.16,
      gridType: '中网',
    };
    const firstByType = buildFirstPositionByType([
      buildLeg('medium-first', '中网', 0.521, 0.52),
      buildLeg('medium-second', '中网', 0.442, 0.44),
    ]);

    expect(getDisplayDropRate(row, firstByType)).toBeCloseTo(-15.16, 2);
  });

  it('sumChildSellStats 应汇总子档卖出股数与卖出金额', () => {
    const legs = [
      buildLeg('a', '小网', 1.0, 1),
      buildLeg('b', '中网', 0.998, 0.5),
    ];
    const map = buildLegGridRowMap(legs, 1.0);

    expect(sumChildSellStats(['a', 'b'], map)).toEqual({
      sellShares: 200,
      sellAmount: 1.0 * 100 + 0.998 * 100,
    });
    expect(sumChildSellStats(['missing'], map)).toEqual({
      sellShares: 0,
      sellAmount: 0,
    });
  });
});
