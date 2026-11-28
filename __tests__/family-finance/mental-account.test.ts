import type { FamilyLedgerItem, FamilyMember, FamilyMentalAccount } from '@/types/family-finance';
import {
  aggregateMentalGoalsByPriority,
  assertMentalAccountDateRange,
  compareMentalAccountPace,
  computeMentalAccountProgress,
  computeMentalAccountTimeProgress,
  formatMentalLedgerOptionLabel,
  groupMentalAccountsByPriority,
  listSelectableMentalLedgerItems,
} from '@/lib/family-finance/mental-account';

function ledger(
  partial: Partial<FamilyLedgerItem> & Pick<FamilyLedgerItem, 'id' | 'amount' | 'fourPot'>
): FamilyLedgerItem {
  return {
    userId: 'u1',
    memberId: 'm1',
    side: 'asset',
    category: 'cash',
    name: '账目',
    currency: 'CNY',
    note: null,
    createdAt: '',
    updatedAt: '',
    ...partial,
  };
}

function account(
  partial: Partial<FamilyMentalAccount> & Pick<FamilyMentalAccount, 'id' | 'ledgerItemIds'>
): FamilyMentalAccount {
  return {
    userId: 'u1',
    name: '应急金',
    targetAmount: 10000,
    priority: 'P1',
    startDate: '2026-01-01',
    targetDate: '2026-12-31',
    showLinkedAccounts: true,
    createdAt: '',
    updatedAt: '',
    ...partial,
  };
}

describe('computeMentalAccountProgress', () => {
  it('按关联的活钱/稳钱/长钱合计计算进度与超额', () => {
    const items = [
      ledger({ id: 'a', amount: 3000, fourPot: 'liquid', name: '活期' }),
      ledger({ id: 'b', amount: 4000, fourPot: 'stable', name: '国债' }),
      ledger({ id: 'c', amount: 4000, fourPot: 'long_term', name: '股票' }),
      ledger({ id: 'd', amount: 9999, fourPot: 'insurance', name: '保险金' }),
    ];
    const result = computeMentalAccountProgress(
      account({ id: 'ma1', targetAmount: 10000, ledgerItemIds: ['a', 'b', 'c', 'd'] }),
      items
    );
    expect(result.current).toBe(11000);
    expect(result.percent).toBeCloseTo(1.1);
    expect(result.chartPercent).toBe(1);
    expect(result.overflow).toBe(1000);
  });

  it('忽略已删除、insurance 或未标注四笔钱的关联', () => {
    const result = computeMentalAccountProgress(
      account({ id: 'ma1', targetAmount: 10000, ledgerItemIds: ['gone', 'x', 'y'] }),
      [
        ledger({ id: 'x', amount: 3000, fourPot: 'insurance' }),
        ledger({ id: 'y', amount: 2000, fourPot: null }),
      ]
    );
    expect(result.current).toBe(0);
    expect(result.percent).toBe(0);
    expect(result.chartPercent).toBe(0);
    expect(result.overflow).toBe(0);
  });

  it('目标非法时进度为 0', () => {
    const result = computeMentalAccountProgress(
      account({ id: 'ma1', targetAmount: 0, ledgerItemIds: ['a'] }),
      [ledger({ id: 'a', amount: 100, fourPot: 'liquid' })]
    );
    expect(result.percent).toBe(0);
    expect(result.chartPercent).toBe(0);
  });
});

describe('assertMentalAccountDateRange', () => {
  it('开始等于达成时通过', () => {
    expect(() => assertMentalAccountDateRange('2026-07-24', '2026-07-24')).not.toThrow();
  });

  it('开始晚于达成时抛错', () => {
    expect(() => assertMentalAccountDateRange('2026-08-01', '2026-07-24')).toThrow(
      '开始日期不能晚于预期达成日期'
    );
  });
});

describe('groupMentalAccountsByPriority', () => {
  it('按 P0→P1→P2 分组，空组省略，组内按 targetDate 升序', () => {
    const groups = groupMentalAccountsByPriority([
      account({ id: 'p2a', priority: 'P2', targetDate: '2027-01-01', ledgerItemIds: [] }),
      account({ id: 'p0b', priority: 'P0', targetDate: '2026-12-01', ledgerItemIds: [] }),
      account({ id: 'p0a', priority: 'P0', targetDate: '2026-06-01', ledgerItemIds: [] }),
      account({ id: 'p1a', priority: 'P1', targetDate: '2026-09-01', ledgerItemIds: [] }),
    ]);
    expect(groups.map(g => g.priority)).toEqual(['P0', 'P1', 'P2']);
    expect(groups[0].accounts.map(a => a.id)).toEqual(['p0a', 'p0b']);
    expect(groups[1].accounts.map(a => a.id)).toEqual(['p1a']);
    expect(groups[2].accounts.map(a => a.id)).toEqual(['p2a']);
  });

  it('无账户时返回空数组', () => {
    expect(groupMentalAccountsByPriority([])).toEqual([]);
  });
});

describe('aggregateMentalGoalsByPriority', () => {
  it('空列表返回三档 0', () => {
    expect(aggregateMentalGoalsByPriority([], [])).toEqual([
      { priority: 'P0', targetSum: 0, currentSum: 0 },
      { priority: 'P1', targetSum: 0, currentSum: 0 },
      { priority: 'P2', targetSum: 0, currentSum: 0 },
    ]);
  });

  it('按优先级合计目标与已达成（超额 current 仍计入）', () => {
    const items = [
      ledger({ id: 'a', amount: 6000, fourPot: 'liquid' }),
      ledger({ id: 'b', amount: 2000, fourPot: 'stable' }),
    ];
    const result = aggregateMentalGoalsByPriority(
      [
        account({
          id: 'ma0',
          priority: 'P0',
          targetAmount: 5000,
          ledgerItemIds: ['a'],
        }),
        account({
          id: 'ma1',
          priority: 'P1',
          targetAmount: 10000,
          ledgerItemIds: ['b'],
        }),
      ],
      items
    );
    expect(result).toEqual([
      { priority: 'P0', targetSum: 5000, currentSum: 6000 },
      { priority: 'P1', targetSum: 10000, currentSum: 2000 },
      { priority: 'P2', targetSum: 0, currentSum: 0 },
    ]);
  });
});

describe('listSelectableMentalLedgerItems', () => {
  const members: FamilyMember[] = [
    {
      id: 'm1',
      userId: 'u1',
      name: '我',
      role: 'self',
      sortOrder: 0,
      createdAt: '',
      updatedAt: '',
    },
  ];

  const items = [
    ledger({ id: 'l1', amount: 1000, fourPot: 'liquid', name: '招商活期', memberId: 'm1' }),
    ledger({ id: 'l2', amount: 2000, fourPot: 'stable', name: '国债', memberId: 'm1' }),
    ledger({ id: 'l3', amount: 3000, fourPot: 'long_term', name: '指数基金', memberId: 'm1' }),
    ledger({ id: 'l4', amount: 4000, fourPot: 'insurance', name: '保险金', memberId: 'm1' }),
  ];

  it('返回未被占用的活钱/稳钱/长钱，排除 insurance', () => {
    const accounts = [account({ id: 'ma1', ledgerItemIds: ['l1'] })];
    const selectable = listSelectableMentalLedgerItems({
      items,
      members,
      allAccounts: accounts,
      editingAccountId: null,
    });
    expect(selectable.map(s => s.id).sort()).toEqual(['l2', 'l3']);
  });

  it('编辑时保留本账户已关联条目', () => {
    const accounts = [account({ id: 'ma1', ledgerItemIds: ['l1'] })];
    const selectable = listSelectableMentalLedgerItems({
      items,
      members,
      allAccounts: accounts,
      editingAccountId: 'ma1',
    });
    expect(selectable.map(s => s.id).sort()).toEqual(['l1', 'l2', 'l3']);
  });
});

describe('formatMentalLedgerOptionLabel', () => {
  it('包含账目名、成员、四笔钱标签与金额', () => {
    const label = formatMentalLedgerOptionLabel(
      ledger({ id: 'l1', amount: 1234.5, fourPot: 'stable', name: '国债', memberId: 'm1' }),
      new Map([['m1', '我']])
    );
    expect(label).toContain('国债');
    expect(label).toContain('我');
    expect(label).toContain('稳钱');
    expect(label).toMatch(/¥|￥|1,234/);
  });
});

describe('computeMentalAccountTimeProgress', () => {
  it('按日历日比例并夹到 [0,1]', () => {
    expect(computeMentalAccountTimeProgress('2026-01-01', '2026-01-11', '2025-12-31')).toBe(0);
    expect(computeMentalAccountTimeProgress('2026-01-01', '2026-01-11', '2026-01-06')).toBeCloseTo(0.5);
    expect(computeMentalAccountTimeProgress('2026-01-01', '2026-01-11', '2026-01-11')).toBe(1);
    expect(computeMentalAccountTimeProgress('2026-01-01', '2026-01-11', '2026-02-01')).toBe(1);
  });

  it('起止同日：今天起算为 100%', () => {
    expect(computeMentalAccountTimeProgress('2026-07-24', '2026-07-24', '2026-07-23')).toBe(0);
    expect(computeMentalAccountTimeProgress('2026-07-24', '2026-07-24', '2026-07-24')).toBe(1);
  });
});

describe('compareMentalAccountPace', () => {
  it('按百分号两位比较并返回对应文案', () => {
    expect(compareMentalAccountPace(0.6, 0.5).message).toBe('领先于计划');
    expect(compareMentalAccountPace(0.4, 0.5).message).toBe('落后于计划');
    expect(compareMentalAccountPace(0.5, 0.5).message).toBe('与计划同步');
    expect(compareMentalAccountPace(0.50004, 0.5).message).toBe('与计划同步');
  });
});
