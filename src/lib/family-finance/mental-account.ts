import type {
  FamilyLedgerItem,
  FamilyMember,
  FamilyMentalAccount,
  MentalAccountPriority,
  MentalAccountPriorityGroup,
  MentalAccountProgress,
  MentalGoalPriorityAggregate,
  SelectableMentalLedgerItem,
} from '@/types/family-finance';
import { FOUR_POT_LABELS, MENTAL_ACCOUNT_PRIORITIES } from '@/types/family-finance';
import { isStructureFourPot, roundMoney } from '@/lib/family-finance/aggregates';
import { formatCny } from '@/lib/family-finance/format';

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * 校验优先级枚举。
 */
export function isValidMentalAccountPriority(
  value: string
): value is MentalAccountPriority {
  return (MENTAL_ACCOUNT_PRIORITIES as readonly string[]).includes(value);
}

/**
 * 校验开始日期 ≤ 预期达成日期（均为 YYYY-MM-DD）。
 */
export function assertMentalAccountDateRange(
  startDate: string,
  targetDate: string
): void {
  if (!ISO_DATE_RE.test(startDate)) {
    throw new Error('请选择开始日期');
  }
  if (!ISO_DATE_RE.test(targetDate)) {
    throw new Error('请选择预期达成日期');
  }
  if (startDate > targetDate) {
    throw new Error('开始日期不能晚于预期达成日期');
  }
}

/**
 * 计算心理账户时间进度：日历日 (today−start)/(target−start)，夹到 [0,1]。
 * @param today YYYY-MM-DD，默认取本地今天
 */
export function computeMentalAccountTimeProgress(
  startDate: string,
  targetDate: string,
  today: string = localIsoDate()
): number {
  if (!ISO_DATE_RE.test(startDate) || !ISO_DATE_RE.test(targetDate)) {
    return 0;
  }
  if (!ISO_DATE_RE.test(today)) {
    return 0;
  }

  const startDay = isoDateToUtcDay(startDate);
  const targetDay = isoDateToUtcDay(targetDate);
  const todayDay = isoDateToUtcDay(today);

  if (startDay === targetDay) {
    return todayDay >= startDay ? 1 : 0;
  }
  if (todayDay <= startDay) return 0;
  if (todayDay >= targetDay) return 1;
  return (todayDay - startDay) / (targetDay - startDay);
}

export type MentalPaceStatus = 'ahead' | 'behind' | 'on_track';

export interface MentalPaceComparison {
  status: MentalPaceStatus;
  /** 鼓励文案 */
  message: string;
  timePercent: number;
}

/**
 * 存款进度（建议用 chartPercent）与时间进度对比；按百分号两位对齐后比较。
 */
export function compareMentalAccountPace(
  depositPercent: number,
  timePercent: number
): MentalPaceComparison {
  const deposit = clampUnit(depositPercent);
  const time = clampUnit(timePercent);
  const depositPct = Number((deposit * 100).toFixed(2));
  const timePct = Number((time * 100).toFixed(2));

  // 状态说明：存款进度与时间进度的对比结论；文案对齐「长流」平实克制的语气
  if (depositPct === timePct) {
    return { status: 'on_track', message: '与计划同步', timePercent: time };
  }
  if (depositPct > timePct) {
    return { status: 'ahead', message: '领先于计划', timePercent: time };
  }
  return { status: 'behind', message: '落后于计划', timePercent: time };
}

function clampUnit(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/** 本地日历日 YYYY-MM-DD。 */
function localIsoDate(): string {
  const now = new Date();
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** YYYY-MM-DD → UTC 日序号（避免本地时区解析偏移）。 */
function isoDateToUtcDay(isoDate: string): number {
  const [year, month, day] = isoDate.split('-').map(Number);
  return Date.UTC(year, month - 1, day) / 86_400_000;
}

/**
 * 计算心理账户进度：计入仍存在且标注为活钱/稳钱/长钱的关联条目。
 */
export function computeMentalAccountProgress(
  account: FamilyMentalAccount,
  items: FamilyLedgerItem[]
): MentalAccountProgress {
  const byId = new Map(items.map(item => [item.id, item]));
  let current = 0;
  for (const id of account.ledgerItemIds) {
    const item = byId.get(id);
    if (!item || item.side !== 'asset' || !isStructureFourPot(item.fourPot)) continue;
    current = roundMoney(current + item.amount);
  }

  const target = account.targetAmount;
  if (!(target > 0)) {
    return { current, percent: 0, chartPercent: 0, overflow: 0 };
  }

  const percent = current / target;
  return {
    current,
    percent,
    chartPercent: Math.min(1, Math.max(0, percent)),
    overflow: roundMoney(Math.max(0, current - target)),
  };
}

/**
 * 按 P0 → P1 → P2 分组；空组省略；组内按 targetDate 升序。
 */
export function groupMentalAccountsByPriority(
  accounts: FamilyMentalAccount[]
): MentalAccountPriorityGroup[] {
  return MENTAL_ACCOUNT_PRIORITIES.flatMap(priority => {
    const group = accounts
      .filter(a => a.priority === priority)
      .slice()
      .sort((a, b) => a.targetDate.localeCompare(b.targetDate));
    return group.length === 0 ? [] : [{ priority, accounts: group }];
  });
}

/**
 * 按优先级汇总目标合计与已达成（固定三档，无账户为 0）。
 */
export function aggregateMentalGoalsByPriority(
  accounts: FamilyMentalAccount[],
  items: FamilyLedgerItem[]
): MentalGoalPriorityAggregate[] {
  return MENTAL_ACCOUNT_PRIORITIES.map(priority => {
    const matched = accounts.filter(a => a.priority === priority);
    let targetSum = 0;
    let currentSum = 0;
    for (const account of matched) {
      targetSum = roundMoney(targetSum + account.targetAmount);
      currentSum = roundMoney(
        currentSum + computeMentalAccountProgress(account, items).current
      );
    }
    return { priority, targetSum, currentSum };
  });
}

/**
 * 多选选项文案：账目名 · 成员 · 四笔钱 · 金额。
 */
export function formatMentalLedgerOptionLabel(
  item: FamilyLedgerItem,
  memberNameById: Map<string, string>
): string {
  const memberName =
    item.memberId != null ? (memberNameById.get(item.memberId) ?? '未知成员') : '家庭';
  const potLabel =
    item.fourPot != null && isStructureFourPot(item.fourPot)
      ? FOUR_POT_LABELS[item.fourPot]
      : '未标注';
  return `${item.name} · ${memberName} · ${potLabel} · ${formatCny(item.amount)}`;
}

/**
 * 可选账目列表：活钱/稳钱/长钱；排除其他心理账户已占用；编辑时保留本账户关联。
 */
export function listSelectableMentalLedgerItems(params: {
  items: FamilyLedgerItem[];
  members: FamilyMember[];
  allAccounts: FamilyMentalAccount[];
  editingAccountId: string | null;
}): SelectableMentalLedgerItem[] {
  const { items, members, allAccounts, editingAccountId } = params;
  const memberNameById = new Map(members.map(m => [m.id, m.name]));

  const occupied = new Set<string>();
  for (const acc of allAccounts) {
    if (editingAccountId != null && acc.id === editingAccountId) continue;
    for (const id of acc.ledgerItemIds) occupied.add(id);
  }

  return items
    .filter(
      item =>
        item.side === 'asset' &&
        isStructureFourPot(item.fourPot) &&
        !occupied.has(item.id)
    )
    .map(item => ({
      id: item.id,
      label: formatMentalLedgerOptionLabel(item, memberNameById),
      amount: item.amount,
    }));
}
