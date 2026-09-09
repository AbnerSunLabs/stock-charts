import type {
  GridLeg,
  GridStrategyOptionsV2,
  GridStrategyParamsV2,
  StrategyWarning,
} from '@/types/grid-v2';
import {
  calculateCostCoverageStepPct,
  extractTradeCost,
} from '@/lib/grid/trade-cost';

/**
 * 生成策略风险警告。
 */
export function buildStrategyWarnings(
  params: GridStrategyParamsV2,
  options: GridStrategyOptionsV2,
  _legs: GridLeg[],
  _amountPerGrid: number
): StrategyWarning[] {
  const warnings: StrategyWarning[] = [];
  const cost = extractTradeCost(params);
  const costCoverageStepPct = calculateCostCoverageStepPct(
    params.basePrice,
    params.priceUnit,
    cost
  );

  appendCostWarnings(warnings, params.smallGridStep, costCoverageStepPct);
  appendAtrWarnings(warnings, params.smallGridStep, options.atr20Pct);

  return warnings;
}

function appendCostWarnings(
  warnings: StrategyWarning[],
  smallGridStep: number,
  costCoverageStepPct: number
): void {
  if (smallGridStep <= costCoverageStepPct) {
    warnings.push({
      code: 'W01',
      level: 'error',
      message: '小网步长小于成本覆盖线，净收益可能为负',
    });
    return;
  }
  if (smallGridStep < costCoverageStepPct * 2) {
    warnings.push({
      code: 'W01-YELLOW',
      level: 'warning',
      message: '小网步长接近成本覆盖线，请注意磨损风险',
    });
  }
}

function appendAtrWarnings(
  warnings: StrategyWarning[],
  smallGridStep: number,
  atr20Pct?: number
): void {
  if (atr20Pct === undefined) return;
  if (smallGridStep < atr20Pct * 0.3) {
    warnings.push({
      code: 'W02',
      level: 'warning',
      message: '步长过密，可能高频磨损',
    });
  }
  if (smallGridStep > atr20Pct * 2) {
    warnings.push({
      code: 'W03',
      level: 'warning',
      message: '步长过宽，可能长期不成交',
    });
  }
}
