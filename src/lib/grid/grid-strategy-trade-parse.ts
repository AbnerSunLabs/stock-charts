import type {
  GridStrategyTrade,
  GridStrategyTradeCreatePayload,
  GridStrategyTradeSide,
} from '@/types/grid-strategy-trade';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertFinitePositive(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new Error(`${label}无效`);
  }
  return value;
}

function assertPositiveInt(value: unknown, label: string): number {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value <= 0
  ) {
    throw new Error(`${label}须为正整数`);
  }
  return value;
}

function assertSide(value: unknown): GridStrategyTradeSide {
  if (value !== 'buy' && value !== 'sell') {
    throw new Error('买卖方向无效');
  }
  return value;
}

function assertDate(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error('成交日期无效');
  }
  return value;
}

/**
 * 规范化标的代码：允许空；最长 32。
 */
export function normalizeGridStrategySymbol(symbol: string | null | undefined): string {
  const trimmed = (symbol ?? '').trim();
  if (trimmed.length > 32) {
    throw new Error('标的代码最多 32 个字符');
  }
  return trimmed;
}

/**
 * 解析 DB 行（snake_case）为流水领域对象。
 */
export function parseGridStrategyTrade(row: unknown): GridStrategyTrade {
  if (!isRecord(row)) {
    throw new Error('流水数据已损坏');
  }
  const priceRaw = row.price;
  const price =
    typeof priceRaw === 'string' ? Number(priceRaw) : assertFinitePositive(priceRaw, '成交价');
  if (!Number.isFinite(price) || price <= 0) {
    throw new Error('成交价无效');
  }
  return {
    id: String(row.id),
    strategyId: String(row.strategy_id),
    levelKey: String(row.level_key).trim(),
    side: assertSide(row.side),
    price,
    qty: assertPositiveInt(row.qty, '股数'),
    tradeDate: assertDate(row.trade_date),
    createdAt: String(row.created_at),
  };
}

/**
 * 校验写入载荷。
 */
export function assertTradeCreatePayload(
  payload: GridStrategyTradeCreatePayload
): GridStrategyTradeCreatePayload {
  const levelKey = payload.levelKey.trim();
  if (levelKey.length < 1 || levelKey.length > 128) {
    throw new Error('档位标识无效');
  }
  return {
    strategyId: payload.strategyId,
    levelKey,
    side: assertSide(payload.side),
    price: assertFinitePositive(payload.price, '成交价'),
    qty: assertPositiveInt(payload.qty, '股数'),
    tradeDate: assertDate(payload.tradeDate),
  };
}
