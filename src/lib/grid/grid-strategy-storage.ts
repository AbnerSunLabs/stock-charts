import type { GridParams, GridRow, StressTest } from '@/types/grid';
import type {
  AggregatedGridRow,
  GridBudgetMode,
  GridLeg,
  GridStrategyState,
  StrategyWarning,
} from '@/types/grid-v2';
import type { GridRunResult } from '@/lib/grid-run-calculation';
import {
  GRID_STRATEGY_SCHEMA_VERSION,
  type GridStrategyConfigV1,
  type GridStrategyMetadata,
  type GridStrategySnapshotV1,
  type SavedGridStrategyV1,
} from '@/types/grid-strategy-storage';

const GRID_PARAM_NUMBER_KEYS = [
  'minTradeUnit',
  'priceUnit',
  'basePrice',
  'minPrice',
  'totalBudget',
  'amountPerGrid',
  'smallGridStep',
  'mediumGridStep',
  'largeGridStep',
  'amountMultiplier',
  'profitReserveMultiplier',
  'buyCommissionRate',
  'sellCommissionRate',
  'minCommission',
  'stampDutyRate',
  'transferFeeRate',
  'slippageTicks',
] as const satisfies ReadonlyArray<keyof GridParams>;

const BUDGET_MODES = new Set<GridBudgetMode>(['auto', 'manual']);
const DYNAMIC_MODES = new Set<'stable' | 'aggressive'>(['stable', 'aggressive']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertFiniteNumber(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error('策略数据已损坏，无法打开');
  }
  return value;
}

function assertString(value: unknown): string {
  if (typeof value !== 'string') {
    throw new Error('策略数据已损坏，无法打开');
  }
  return value;
}

/**
 * 规范化策略名称：trim；非法时抛中文错误。
 */
export function normalizeGridStrategyName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length < 1 || trimmed.length > 50) {
    throw new Error('策略名称需为 1～50 个字符');
  }
  return trimmed;
}

/**
 * 逐字段比较 v1 配置，不依赖属性顺序。
 */
export function isSameGridStrategyConfig(
  left: GridStrategyConfigV1,
  right: GridStrategyConfigV1
): boolean {
  if (left.dynamicGridEnabled !== right.dynamicGridEnabled) return false;
  if (left.dynamicGridMode !== right.dynamicGridMode) return false;
  if (left.params.budgetMode !== right.params.budgetMode) return false;
  for (const key of GRID_PARAM_NUMBER_KEYS) {
    if (left.params[key] !== right.params[key]) return false;
  }
  return true;
}

function parseGridParams(value: unknown): GridParams {
  if (!isRecord(value)) {
    throw new Error('策略数据已损坏，无法打开');
  }
  const budgetMode = value.budgetMode;
  if (typeof budgetMode !== 'string' || !BUDGET_MODES.has(budgetMode as GridBudgetMode)) {
    throw new Error('策略数据已损坏，无法打开');
  }
  const params = { budgetMode: budgetMode as GridBudgetMode } as GridParams;
  for (const key of GRID_PARAM_NUMBER_KEYS) {
    params[key] = assertFiniteNumber(value[key]);
  }
  return params;
}

function parseConfig(value: unknown): GridStrategyConfigV1 {
  if (!isRecord(value)) {
    throw new Error('策略数据已损坏，无法打开');
  }
  if (typeof value.dynamicGridEnabled !== 'boolean') {
    throw new Error('策略数据已损坏，无法打开');
  }
  const mode = value.dynamicGridMode;
  if (typeof mode !== 'string' || !DYNAMIC_MODES.has(mode as 'stable' | 'aggressive')) {
    throw new Error('策略数据已损坏，无法打开');
  }
  return {
    params: parseGridParams(value.params),
    dynamicGridEnabled: value.dynamicGridEnabled,
    dynamicGridMode: mode as 'stable' | 'aggressive',
  };
}

function parseSnapshot(value: unknown): GridStrategySnapshotV1 {
  if (!isRecord(value)) {
    throw new Error('策略数据已损坏，无法打开');
  }
  if (!Array.isArray(value.gridData) || value.gridData.length === 0) {
    throw new Error('策略数据已损坏，无法打开');
  }
  if (!Array.isArray(value.legs) || value.legs.length === 0) {
    throw new Error('策略数据已损坏，无法打开');
  }
  if (!Array.isArray(value.aggregatedRows) || value.aggregatedRows.length === 0) {
    throw new Error('策略数据已损坏，无法打开');
  }
  if (value.stressTest === null || value.stressTest === undefined) {
    throw new Error('策略数据已损坏，无法打开');
  }
  if (!isRecord(value.stressTest)) {
    throw new Error('策略数据已损坏，无法打开');
  }
  if (!Array.isArray(value.calculationErrors) || value.calculationErrors.length !== 0) {
    throw new Error('策略数据已损坏，无法打开');
  }
  if (!Array.isArray(value.warnings)) {
    throw new Error('策略数据已损坏，无法打开');
  }
  return {
    gridData: value.gridData as GridRow[],
    stressTest: value.stressTest as unknown as StressTest,
    legs: value.legs as GridLeg[],
    aggregatedRows: value.aggregatedRows as AggregatedGridRow[],
    amountPerGrid: assertFiniteNumber(value.amountPerGrid),
    warnings: value.warnings as StrategyWarning[],
    state: (value.state as GridStrategyState | null) ?? null,
    calculationErrors: [],
  };
}

/**
 * 解析列表行元数据（不含 JSONB）。
 */
export function parseGridStrategyMetadata(row: unknown): GridStrategyMetadata {
  if (!isRecord(row)) {
    throw new Error('策略数据已损坏，无法打开');
  }
  const schemaVersion = row.schema_version;
  if (schemaVersion !== GRID_STRATEGY_SCHEMA_VERSION) {
    throw new Error('该策略版本暂不支持');
  }
  const symbolRaw = row.symbol;
  const symbol =
    symbolRaw == null || symbolRaw === ''
      ? ''
      : String(symbolRaw).trim().slice(0, 32);

  return {
    id: assertString(row.id),
    name: normalizeGridStrategyName(assertString(row.name)),
    symbol,
    schemaVersion: GRID_STRATEGY_SCHEMA_VERSION,
    createdAt: assertString(row.created_at),
    updatedAt: assertString(row.updated_at),
  };
}

/**
 * 解析数据库行（snake_case）为领域对象；未知版本与损坏结构抛中文错误。
 */
export function parseSavedGridStrategy(row: unknown): SavedGridStrategyV1 {
  if (!isRecord(row)) {
    throw new Error('策略数据已损坏，无法打开');
  }
  const meta = parseGridStrategyMetadata(row);
  return {
    ...meta,
    config: parseConfig(row.config),
    resultSnapshot: parseSnapshot(row.result_snapshot),
  };
}

/** 将成功计算结果收窄为可持久化快照（失败则抛错） */
export function assertSuccessfulGridSnapshot(
  result: GridRunResult
): GridStrategySnapshotV1 {
  return parseSnapshot(result);
}
