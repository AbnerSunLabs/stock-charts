import type { GridBudgetMode, StressTestV2 } from '@/types/grid-v2';

export type GridType = '小网' | '中网' | '大网';

export interface GridRow {
  position: number;
  buyTriggerPrice: number;
  buyPrice: number;
  buyAmount: number;
  buyShares: number;
  sellTriggerPrice: number;
  sellPrice: number;
  sellShares: number;
  sellAmount: number;
  priceDropRate: number;
  gridType: GridType;
}

export interface StressTest {
  totalBuyAmount: number;
  totalBuyShares: number;
  totalSellAmount: number;
  totalSellShares: number;
  remainingShares: number;
  profit: number;
  profitRate: number;
  /** Phase 1 扩展指标（可选） */
  v2?: StressTestV2;
}

export interface GridParams {
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
}

/** 页面默认参数（含 Phase 1 成本默认值） */
export const DEFAULT_GRID_PARAMS: GridParams = {
  minTradeUnit: 100,
  priceUnit: 0.001,
  basePrice: 1.0,
  minPrice: 0.5,
  totalBudget: 500000,
  budgetMode: 'manual',
  amountPerGrid: 10000,
  smallGridStep: 5.0,
  mediumGridStep: 15.0,
  largeGridStep: 30.0,
  amountMultiplier: 1.0,
  profitReserveMultiplier: 1.0,
  buyCommissionRate: 0.0001,
  sellCommissionRate: 0.0001,
  minCommission: 0,
  stampDutyRate: 0,
  transferFeeRate: 0,
  slippageTicks: 5,
};
