import { normalizeJournalStrategyId } from '@/lib/grid/grid-journal-filter';

describe('normalizeJournalStrategyId', () => {
  it('策略仍在列表中时保留当前筛选', () => {
    expect(
      normalizeJournalStrategyId('strategy-b', ['strategy-a', 'strategy-b'], false)
    ).toBe('strategy-b');
  });

  it('策略列表加载中时不提前清空当前筛选', () => {
    expect(normalizeJournalStrategyId('strategy-b', [], true)).toBe('strategy-b');
  });

  it('加载完成后将已失效策略回退为全部策略', () => {
    expect(normalizeJournalStrategyId('strategy-b', ['strategy-a'], false)).toBe(
      'all'
    );
  });
});
