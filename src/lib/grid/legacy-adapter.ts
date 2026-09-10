import type { GridRow, GridType, StressTest } from '@/types/grid';
import type {
  AggregatedGridRow,
  CalculateGridStrategyV2Result,
  GridLeg,
  GridStrategyParamsV2,
  StressTestV2,
} from '@/types/grid-v2';

/**
 * 将 V2 legs 转为旧版 GridRow（供图表与表格兼容）。
 */
export function legsToGridRows(
  legs: GridLeg[],
  basePrice: number
): GridRow[] {
  const sorted = [...legs].sort((a, b) => b.buyPrice - a.buyPrice);
  const lastByLayer = new Map<string, number>();

  return sorted.map(leg => {
    const layerKey = leg.gridLabel;
    const prevPrice = lastByLayer.get(layerKey);
    let priceDropRate = 0;

    if (prevPrice !== undefined) {
      priceDropRate = ((leg.buyPrice - prevPrice) / prevPrice) * 100;
    } else if (leg.gridLabel === '中网' || leg.gridLabel === '大网') {
      priceDropRate = ((basePrice - leg.buyPrice) / basePrice) * 100;
    }

    lastByLayer.set(layerKey, leg.buyPrice);

    return {
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
    };
  });
}

/**
 * 将 V2 压力测试转为旧版 StressTest（向后兼容）。
 */
export function stressTestV2ToLegacy(
  stressTest: StressTestV2,
  legs: GridLeg[]
): StressTest {
  const totalSellAmount = legs.reduce((sum, leg) => sum + leg.sellAmount, 0);

  return {
    totalBuyAmount: stressTest.totalBudgetRequired,
    totalBuyShares: stressTest.totalBuyShares,
    totalSellAmount: totalSellAmount,
    totalSellShares: stressTest.totalSellShares,
    remainingShares: stressTest.basePositionShares,
    profit: stressTest.totalNetProfit,
    profitRate: parseFloat(stressTest.totalNetProfitRate.toFixed(2)),
    v2: stressTest,
  };
}

/**
 * 从 V2 结果提取完整页面数据。
 */
export function adaptV2Result(
  result: CalculateGridStrategyV2Result,
  params: GridStrategyParamsV2
): {
  gridData: GridRow[];
  stressTest: StressTest;
  aggregatedRows: AggregatedGridRow[];
  amountPerGrid: number;
  warnings: CalculateGridStrategyV2Result['warnings'];
  state: CalculateGridStrategyV2Result['state'];
} {
  return {
    gridData: legsToGridRows(result.legs, params.basePrice),
    stressTest: stressTestV2ToLegacy(result.stressTest, result.legs),
    aggregatedRows: result.aggregatedRows,
    amountPerGrid: result.amountPerGrid,
    warnings: result.warnings,
    state: result.state,
  };
}
