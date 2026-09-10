/** 网格层类型（内部计算用） */
export type GridLayerType = 'small' | 'medium' | 'large';

/** 网格层展示名 */
export type GridLayerLabel = '小网' | '中网' | '大网';

/** 策略状态 */
export type GridStrategyState =
  | 'blocked'
  | 'wait'
  | 'normal'
  | 'accumulate'
  | 'sellOnly'
  | 'stopped';

/** 预算模式：auto 由总弹药反推单格金额，manual 使用手填 amountPerGrid */
export type GridBudgetMode = 'auto' | 'manual';

/** 交易成本参数 */
export interface TradeCostParams {
  buyCommissionRate: number;
  sellCommissionRate: number;
  minCommission: number;
  stampDutyRate: number;
  transferFeeRate: number;
  slippageTicks: number;
}

/** Phase 1 网格策略输入参数 */
export interface GridStrategyParamsV2 {
  minTradeUnit: number;
  priceUnit: number;
  basePrice: number;
  minPrice: number;
  totalBudget: number;
  budgetMode: GridBudgetMode;
  amountPerGrid: number;
  smallGridStep: number;
  mediumGridStep: number;
  largeGridStep: number;
  amountMultiplier: number;
  profitReserveMultiplier: number;
  buyCommissionRate: number;
  sellCommissionRate: number;
  minCommission: number;
  stampDutyRate: number;
  transferFeeRate: number;
  slippageTicks: number;
  /** 最后一档对齐步长；缺省 false */
  alignLastGridToStep: boolean;
}

/** 计算选项 */
export interface GridStrategyOptionsV2 {
  dynamicGridEnabled: boolean;
  dynamicGridMode: 'stable' | 'aggressive';
  maxGridCount?: number;
  currentPrice?: number;
  /** Phase 2 指标，Phase 1 仅用于警告 */
  atr20Pct?: number;
}

/** 价格线档位（尚未分配资金） */
export interface PriceLadderEntry {
  gridType: GridLayerType;
  gridLabel: GridLayerLabel;
  indexInLayer: number;
  buyPrice: number;
  sellPrice: number;
  stepRatio: number;
  effectiveStepRatio: number;
  isBottomGrid: boolean;
}

/** 单条网格腿（内部记账） */
export interface GridLeg {
  id: string;
  gridType: GridLayerType;
  gridLabel: GridLayerLabel;
  indexInLayer: number;
  buyPrice: number;
  buyExecutionPrice: number;
  sellPrice: number;
  sellExecutionPrice: number;
  effectiveStepRatio: number;
  positionRatio: number;
  amountWeight: number;
  plannedBuyAmount: number;
  buyShares: number;
  actualBuyAmount: number;
  buyCommission: number;
  sellShares: number;
  reservedShares: number;
  sellAmount: number;
  sellCommission: number;
  gridNetProfit: number;
  reserveCost: number;
  isBottomGrid: boolean;
}

/** 聚合行卖出计划 */
export interface AggregatedSellPlan {
  legId: string;
  gridLabel: GridLayerLabel;
  sellPrice: number;
  sellShares: number;
}

/** 跨层聚合展示行 */
export interface AggregatedGridRow {
  clusterId: string;
  gridTypes: GridLayerLabel[];
  displayType: string;
  buyPriceHigh: number;
  buyPriceLow: number;
  displayBuyPrice: number;
  triggerBuyPrice: number;
  totalBuyAmount: number;
  totalBuyShares: number;
  childLegIds: string[];
  sellPlans: AggregatedSellPlan[];
}

/** 压力测试 V2 */
export interface StressTestV2 {
  totalBudget: number;
  amountPerGrid: number;
  totalBudgetRequired: number;
  budgetUsageRate: number;
  maxClusterCashDemand: number;
  totalBuyShares: number;
  totalSellShares: number;
  realizedGridProfit: number;
  realizedGridProfitRate: number;
  basePositionShares: number;
  basePositionCost: number;
  basePositionMarketValue: number;
  basePositionUnrealizedPnL: number;
  totalNetProfit: number;
  totalNetProfitRate: number;
  totalCommission: number;
  totalSlippageCost: number;
  costCoverageStepPct: number;
}

/** 策略警告 */
export interface StrategyWarning {
  code: string;
  level: 'info' | 'warning' | 'error';
  message: string;
}

/** V2 计算结果 */
export interface CalculateGridStrategyV2Result {
  amountPerGrid: number;
  legs: GridLeg[];
  aggregatedRows: AggregatedGridRow[];
  stressTest: StressTestV2;
  warnings: StrategyWarning[];
  state: GridStrategyState;
}

/** 默认 ETF 交易成本 */
export const DEFAULT_TRADE_COST: TradeCostParams = {
  buyCommissionRate: 0.0001,
  sellCommissionRate: 0.0001,
  minCommission: 0,
  stampDutyRate: 0,
  transferFeeRate: 0,
  slippageTicks: 5,
};
