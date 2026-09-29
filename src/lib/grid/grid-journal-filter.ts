/**
 * 策略列表刷新期间保留跳转目标；刷新结束后丢弃已不存在的策略筛选。
 */
export function normalizeJournalStrategyId(
  strategyId: string | 'all',
  availableStrategyIds: string[],
  loading: boolean
): string | 'all' {
  if (strategyId === 'all' || loading) return strategyId;
  return availableStrategyIds.includes(strategyId) ? strategyId : 'all';
}
