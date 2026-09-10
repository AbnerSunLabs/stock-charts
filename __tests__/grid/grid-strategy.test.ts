import { DEFAULT_GRID_PARAMS } from '@/types/grid';
import { generateAllPriceLadders } from '@/lib/grid/price-ladder';
import { calculateGridStrategyV2 } from '@/lib/grid/grid-strategy';
import type {
  AggregatedGridRow,
  GridStrategyOptionsV2,
  GridStrategyParamsV2,
} from '@/types/grid-v2';

const STATIC_OPTIONS: GridStrategyOptionsV2 = {
  dynamicGridEnabled: false,
  dynamicGridMode: 'stable',
};

const DYNAMIC_STABLE: GridStrategyOptionsV2 = {
  dynamicGridEnabled: true,
  dynamicGridMode: 'stable',
};

const DYNAMIC_AGGRESSIVE: GridStrategyOptionsV2 = {
  dynamicGridEnabled: true,
  dynamicGridMode: 'aggressive',
};

function buildParams(
  overrides: Partial<GridStrategyParamsV2> = {}
): GridStrategyParamsV2 {
  return { ...DEFAULT_GRID_PARAMS, budgetMode: 'manual', ...overrides };
}

/** 与 GridResultTable 一致：多腿为可展开聚合行，单腿为明细行 */
function classifyTableRows(aggregatedRows: AggregatedGridRow[]) {
  const groupRows = aggregatedRows.filter(r => r.childLegIds.length > 1);
  const detailRows = aggregatedRows.filter(r => r.childLegIds.length === 1);
  return { groupRows, detailRows };
}

function assertLastGridPriceRule(
  result: ReturnType<typeof calculateGridStrategyV2>,
  minPrice: number
): void {
  const byLayer = {
    small: result.legs.filter(leg => leg.gridType === 'small'),
    medium: result.legs.filter(leg => leg.gridType === 'medium'),
    large: result.legs.filter(leg => leg.gridType === 'large'),
  };

  (['small', 'medium', 'large'] as const).forEach(layer => {
    const legs = byLayer[layer];
    if (legs.length === 0) return;
    legs.forEach(leg => {
      expect(leg.buyPrice).toBeGreaterThanOrEqual(minPrice - 0.0001);
    });
    const lastLeg = legs.reduce((a, b) => (a.buyPrice < b.buyPrice ? a : b));
    expect(lastLeg.isBottomGrid).toBe(true);
    expect(lastLeg.buyPrice).toBeGreaterThan(0);
    // 硬地板：最后一网夹到 minPrice，不得更深
    expect(lastLeg.buyPrice).toBeCloseTo(minPrice, 3);
  });
}

function assertAggregationPreservesLegs(
  result: ReturnType<typeof calculateGridStrategyV2>
): void {
  const sellPriceMap = new Map(
    result.legs.map(leg => [leg.id, leg.sellPrice])
  );

  result.aggregatedRows.forEach(row => {
    row.sellPlans.forEach(plan => {
      expect(sellPriceMap.get(plan.legId)).toBe(plan.sellPrice);
    });
  });
  expect(
    result.aggregatedRows.reduce(
      (sum, row) => sum + row.childLegIds.length,
      0
    )
  ).toBe(result.legs.length);
}

describe('Phase 1 DOD: calculateGridStrategyV2', () => {
  it('总投入不超过总弹药', () => {
    const params = buildParams({ totalBudget: 200000, budgetMode: 'auto' });
    const result = calculateGridStrategyV2(params, STATIC_OPTIONS);

    expect(result.legs.length).toBeGreaterThan(0);
    expect(result.stressTest.totalBudgetRequired).toBeLessThanOrEqual(
      params.totalBudget + 1
    );
  });

  it('最后一网价格规则：夹到 minPrice 硬地板', () => {
    const params = buildParams({ minPrice: 0.5, basePrice: 1.0 });
    const result = calculateGridStrategyV2(params, STATIC_OPTIONS);
    assertLastGridPriceRule(result, params.minPrice);
  });

  it('计算价低于 minPrice 时最后一网仍夹到 minPrice', () => {
    const params = buildParams({
      minPrice: 0.55,
      basePrice: 1.0,
      smallGridStep: 10,
    });
    const result = calculateGridStrategyV2(params, STATIC_OPTIONS);
    const smallLegs = result.legs.filter(leg => leg.gridType === 'small');
    const lastSmall = smallLegs.reduce((a, b) =>
      a.buyPrice < b.buyPrice ? a : b
    );

    expect(lastSmall.isBottomGrid).toBe(true);
    expect(lastSmall.buyPrice).toBeCloseTo(params.minPrice, 3);
    expect(lastSmall.buyPrice).toBeGreaterThanOrEqual(params.minPrice - 0.0001);
  });

  it('对齐步长：首次低于 minPrice 的那一档留下后收网', () => {
    const params = buildParams({
      minPrice: 0.7,
      basePrice: 1.0,
      smallGridStep: 10,
      mediumGridStep: 20,
      largeGridStep: 30,
      alignLastGridToStep: true,
    });
    const ladder = generateAllPriceLadders(params, STATIC_OPTIONS);
    const smallPrices = ladder
      .filter(entry => entry.gridType === 'small')
      .map(entry => entry.buyPrice);
    const last = smallPrices[smallPrices.length - 1];

    expect(last).toBeLessThan(params.minPrice);
    smallPrices.slice(0, -1).forEach(price => {
      expect(price).toBeGreaterThan(params.minPrice);
    });
    expect(last).not.toBeCloseTo(params.minPrice, 3);
  });

  it('对齐步长且达档位上限时不补 minPrice 桩', () => {
    const params = buildParams({
      basePrice: 341.433,
      minPrice: 111.084,
      priceUnit: 0.001,
      smallGridStep: 17,
      mediumGridStep: 40.6,
      largeGridStep: 62.3,
      alignLastGridToStep: true,
    });
    const options: GridStrategyOptionsV2 = {
      dynamicGridEnabled: true,
      dynamicGridMode: 'aggressive',
      maxGridCount: 2,
    };
    const ladder = generateAllPriceLadders(params, options);
    const mediumBuyPrices = ladder
      .filter(entry => entry.gridType === 'medium')
      .map(entry => entry.buyPrice);

    expect(mediumBuyPrices).toEqual([202.811, 120.469]);
    expect(mediumBuyPrices).not.toContain(params.minPrice);
  });

  it('最低价兜底不应保留落入同一聚合组的同层普通档', () => {
    const params = buildParams({
      basePrice: 0.85,
      minPrice: 0.5,
      smallGridStep: 10,
      mediumGridStep: 20,
      largeGridStep: 30,
    });
    const ladder = generateAllPriceLadders(params, STATIC_OPTIONS);
    const smallBuyPrices = ladder
      .filter(entry => entry.gridType === 'small')
      .map(entry => entry.buyPrice);

    expect(smallBuyPrices).toEqual([0.85, 0.765, 0.688, 0.619, 0.557, 0.5]);

    const result = calculateGridStrategyV2(params, STATIC_OPTIONS);
    const bottomRow = result.aggregatedRows.find(
      row => row.buyPriceLow === 0.5
    );
    const childLegs = result.legs.filter(leg =>
      bottomRow?.childLegIds.includes(leg.id)
    );
    const layerCounts = childLegs.reduce(
      (counts, leg) => ({
        ...counts,
        [leg.gridType]: counts[leg.gridType] + 1,
      }),
      { small: 0, medium: 0, large: 0 }
    );

    expect(layerCounts).toEqual({ small: 1, medium: 1, large: 1 });
  });

  it('tick 阈值连续压缩时最低价组仍应保持同层唯一', () => {
    const params = buildParams({
      basePrice: 0.11,
      minPrice: 0.1001,
      priceUnit: 0.001,
      smallGridStep: 0.1,
      mediumGridStep: 25,
      largeGridStep: 50,
    });
    const result = calculateGridStrategyV2(params, {
      ...STATIC_OPTIONS,
      maxGridCount: 10,
    });
    const smallBottomPrices = result.legs
      .filter(leg => leg.gridType === 'small' && leg.isBottomGrid)
      .map(leg => leg.buyPrice);
    const bottomLegIds = new Set(
      result.legs.filter(leg => leg.isBottomGrid).map(leg => leg.id)
    );
    const bottomRow = result.aggregatedRows.find(row =>
      row.childLegIds.some(id => bottomLegIds.has(id))
    );
    const layerCounts = result.legs
      .filter(leg => bottomRow?.childLegIds.includes(leg.id))
      .reduce(
        (counts, leg) => ({
          ...counts,
          [leg.gridType]: counts[leg.gridType] + 1,
        }),
        { small: 0, medium: 0, large: 0 }
      );

    expect(smallBottomPrices).toEqual([0.101]);
    expect(layerCounts).toEqual({ small: 1, medium: 1, large: 1 });
  });

  it('跨层锚点已将普通档分组时不应误删该档', () => {
    const params = buildParams({
      basePrice: 341.433,
      minPrice: 111.084,
      priceUnit: 0.001,
      smallGridStep: 17,
      mediumGridStep: 40.6,
      largeGridStep: 62.3,
    });
    const options: GridStrategyOptionsV2 = {
      dynamicGridEnabled: true,
      dynamicGridMode: 'aggressive',
      maxGridCount: 2,
    };
    const ladder = generateAllPriceLadders(params, options);
    const mediumBuyPrices = ladder
      .filter(entry => entry.gridType === 'medium')
      .map(entry => entry.buyPrice);

    expect(mediumBuyPrices).toEqual([202.811, 120.469, 111.084]);

    const result = calculateGridStrategyV2(params, options);
    const bottomLegIds = new Set(
      result.legs.filter(leg => leg.isBottomGrid).map(leg => leg.id)
    );
    const bottomRow = result.aggregatedRows.find(row =>
      row.childLegIds.some(id => bottomLegIds.has(id))
    );
    const layerCounts = result.legs
      .filter(leg => bottomRow?.childLegIds.includes(leg.id))
      .reduce(
        (counts, leg) => ({
          ...counts,
          [leg.gridType]: counts[leg.gridType] + 1,
        }),
        { small: 0, medium: 0, large: 0 }
      );

    expect(layerCounts).toEqual({ small: 1, medium: 1, large: 1 });
  });

  it('聚合不破坏配对：legs 数量与 sellPrice 不变', () => {
    const result = calculateGridStrategyV2(buildParams(), STATIC_OPTIONS);
    assertAggregationPreservesLegs(result);
  });

  it('成本入模：佣金改变净利润且成本覆盖步长可计算', () => {
    const lowCost = buildParams({
      buyCommissionRate: 0,
      sellCommissionRate: 0,
      slippageTicks: 0,
    });
    const highCost = buildParams({
      buyCommissionRate: 0.01,
      sellCommissionRate: 0.01,
      slippageTicks: 10,
    });

    const lowResult = calculateGridStrategyV2(lowCost, STATIC_OPTIONS);
    const highResult = calculateGridStrategyV2(highCost, STATIC_OPTIONS);

    expect(highResult.stressTest.realizedGridProfit).toBeLessThan(
      lowResult.stressTest.realizedGridProfit
    );
    expect(highResult.stressTest.costCoverageStepPct).toBeGreaterThan(
      lowResult.stressTest.costCoverageStepPct
    );
  });

  it('sellShares=0 且 minCommission>0 时不应计入 phantom 卖出佣金', () => {
    const params = buildParams({
      minCommission: 5,
      profitReserveMultiplier: 7,
      amountPerGrid: 5000,
    });
    const result = calculateGridStrategyV2(params, STATIC_OPTIONS);
    const zeroSellLegs = result.legs.filter(
      leg => leg.sellShares === 0 && leg.buyShares > 0
    );

    expect(zeroSellLegs.length).toBeGreaterThan(0);
    zeroSellLegs.forEach(leg => {
      expect(leg.sellCommission).toBe(0);
      expect(leg.gridNetProfit).toBe(0);
    });
  });

  it('底仓拆分：basePositionShares = sum(reservedShares)', () => {
    const params = buildParams({ profitReserveMultiplier: 1 });
    const result = calculateGridStrategyV2(params, STATIC_OPTIONS);
    const reservedSum = result.legs.reduce(
      (sum, leg) => sum + leg.reservedShares,
      0
    );

    expect(result.stressTest.basePositionShares).toBe(reservedSum);
    result.legs.forEach(leg => {
      expect(leg.sellShares + leg.reservedShares).toBe(leg.buyShares);
      expect(leg.sellShares).toBeGreaterThanOrEqual(0);
      expect(leg.reservedShares).toBeGreaterThanOrEqual(0);
    });
  });

  it('currentPrice <= minPrice 时 state 为 stopped', () => {
    const params = buildParams({ minPrice: 0.5 });
    const result = calculateGridStrategyV2(params, {
      ...STATIC_OPTIONS,
      currentPrice: 0.5,
    });
    expect(result.state).toBe('stopped');
  });

  it('totalNetProfit = realizedGridProfit + basePositionUnrealizedPnL', () => {
    const result = calculateGridStrategyV2(buildParams(), STATIC_OPTIONS);
    const { stressTest } = result;

    expect(stressTest.totalNetProfit).toBeCloseTo(
      stressTest.realizedGridProfit + stressTest.basePositionUnrealizedPnL,
      4
    );
  });

  it('中网起点低于 minPrice 时只生成兜底档', () => {
    const params = buildParams({
      basePrice: 1.0,
      minPrice: 0.75,
      largeGridStep: 30,
      mediumGridStep: 20,
      smallGridStep: 5,
    });
    const result = calculateGridStrategyV2(params, STATIC_OPTIONS);
    const largeLegs = result.legs.filter(leg => leg.gridType === 'large');

    expect(largeLegs.length).toBeGreaterThan(0);
    largeLegs.forEach(leg => {
      expect(leg.buyPrice).toBeGreaterThanOrEqual(params.minPrice - 0.0001);
      expect(leg.buyPrice).toBeCloseTo(params.minPrice, 3);
    });
  });
});

describe('Phase 1 DOD: 动态步长', () => {
  const manualParams = buildParams({ amountPerGrid: 10000 });

  it('动态与静态可区分', () => {
    const staticResult = calculateGridStrategyV2(manualParams, STATIC_OPTIONS);
    const dynamicResult = calculateGridStrategyV2(
      manualParams,
      DYNAMIC_AGGRESSIVE
    );

    expect(dynamicResult.legs.length).toBeGreaterThan(0);
    expect(dynamicResult.legs).not.toEqual(staticResult.legs);
    expect(dynamicResult.aggregatedRows).not.toEqual(
      staticResult.aggregatedRows
    );
  });

  it('层内步长逐档放大', () => {
    const ladder = generateAllPriceLadders(manualParams, DYNAMIC_AGGRESSIVE);
    const layers = ['small', 'medium', 'large'] as const;

    layers.forEach(layer => {
      const entries = ladder
        .filter(entry => entry.gridType === layer)
        .sort((a, b) => a.indexInLayer - b.indexInLayer);

      if (entries.length < 3) return;

      expect(entries[2].stepRatio).toBeGreaterThan(entries[1].stepRatio);
    });
  });

  it('动态步长约束：stepRatio < 1 且 buyPrice > 0', () => {
    const ladder = generateAllPriceLadders(manualParams, DYNAMIC_AGGRESSIVE);

    ladder.forEach(entry => {
      expect(entry.stepRatio).toBeLessThan(1);
      expect(entry.buyPrice).toBeGreaterThan(0);
      expect(entry.sellPrice).toBeGreaterThan(entry.buyPrice);
    });
  });

  it('动态下兜底网仍满足最后一网规则', () => {
    const params = buildParams({ minPrice: 0.5, basePrice: 1.0 });
    const result = calculateGridStrategyV2(params, DYNAMIC_STABLE);
    assertLastGridPriceRule(result, params.minPrice);
  });

  it('动态下总弹药反推不超过预算', () => {
    const params = buildParams({ totalBudget: 200000, budgetMode: 'auto' });
    const result = calculateGridStrategyV2(params, DYNAMIC_AGGRESSIVE);

    expect(result.legs.length).toBeGreaterThan(0);
    expect(result.stressTest.totalBudgetRequired).toBeLessThanOrEqual(
      params.totalBudget + 1
    );
  });

  it('动态下聚合不破坏 legs 配对', () => {
    const result = calculateGridStrategyV2(manualParams, DYNAMIC_STABLE);
    assertAggregationPreservesLegs(result);
  });

  it('抄底模式在 minPrice 硬地板处可跨层聚合', () => {
    const result = calculateGridStrategyV2(manualParams, DYNAMIC_AGGRESSIVE);
    const { groupRows } = classifyTableRows(result.aggregatedRows);

    expect(result.legs.length).toBe(12);
    // 各层最后一网均夹到同一 minPrice，因此出现跨层组合行
    expect(groupRows.length).toBeGreaterThanOrEqual(1);
    expect(groupRows.some(row => row.childLegIds.length >= 2)).toBe(true);
  });

  it('稳健模式组合组数少于静态', () => {
    const staticResult = calculateGridStrategyV2(manualParams, STATIC_OPTIONS);
    const dynamicResult = calculateGridStrategyV2(manualParams, DYNAMIC_STABLE);
    const staticGroups = classifyTableRows(staticResult.aggregatedRows).groupRows;
    const dynamicGroups = classifyTableRows(
      dynamicResult.aggregatedRows
    ).groupRows;

    expect(staticGroups.length).toBe(5);
    expect(dynamicGroups.length).toBeGreaterThan(0);
    expect(dynamicGroups.length).toBeLessThan(staticGroups.length);
  });

  it.each([
    ['static', STATIC_OPTIONS],
    ['dynamic-stable', DYNAMIC_STABLE],
    ['dynamic-aggressive', DYNAMIC_AGGRESSIVE],
  ] as const)(
    '底仓拆分在 %s 模式下成立',
    (_label, options) => {
      const params = buildParams({ profitReserveMultiplier: 1 });
      const result = calculateGridStrategyV2(params, options);
      const reservedSum = result.legs.reduce(
        (sum, leg) => sum + leg.reservedShares,
        0
      );
      expect(result.stressTest.basePositionShares).toBe(reservedSum);
    }
  );
});
