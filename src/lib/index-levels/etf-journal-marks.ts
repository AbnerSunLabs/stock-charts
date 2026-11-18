import { extractEtfCode } from '@/lib/grid/grid-board-close-quote';
import type { EtfTradeMark } from '@/lib/index-levels/media-etf-trades';

/** 点位页上跟网格流水走的场内代码。512170 不另存一份快照。 */
export const JOURNAL_LINKED_ETFS = ['563360', '512170'] as const;

/** 这只场内基金的买卖点是否必须跟网格流水走。 */
export function isJournalLinkedEtf(code: string | undefined): boolean {
  return code != null && (JOURNAL_LINKED_ETFS as readonly string[]).includes(code);
}

export interface JournalMarkStrategy {
  id: string;
  symbol: string;
}

export interface JournalMarkTrade {
  strategyId: string;
  tradeDate: string;
  price: number;
  side: 'buy' | 'sell';
  createdAt: string;
}

export type EtfJournalMarks =
  | { status: 'pending' }
  | { status: 'signed-out' }
  | { status: 'live'; marks: EtfTradeMark[] };

/**
 * 标的代码对得上的流水，按成交日、录入时间排。同一天后一笔排在后面，图上会盖住前一笔。
 */
export function journalTradesToMarks(
  strategies: JournalMarkStrategy[],
  trades: JournalMarkTrade[],
  etfCode: string
): EtfTradeMark[] {
  const ids = new Set(
    strategies.filter(item => extractEtfCode(item.symbol) === etfCode).map(item => item.id)
  );
  return trades
    .filter(item => ids.has(item.strategyId))
    .sort((a, b) => a.tradeDate.localeCompare(b.tradeDate) || a.createdAt.localeCompare(b.createdAt))
    .map(item => ({ tradeDate: item.tradeDate, price: item.price, side: item.side }));
}

/**
 * 已登录且标的在关联名单里时只用流水。还在读时先不画。
 * 未登录用调用方给的快照；512170 没有快照，所以未登录不画点。
 */
export function resolveEtfChartMarks(
  code: string | undefined,
  journal: EtfJournalMarks,
  staticMarks: EtfTradeMark[]
): EtfTradeMark[] {
  if (!isJournalLinkedEtf(code)) return staticMarks;
  if (journal.status === 'live') return journal.marks;
  if (journal.status === 'pending') return [];
  return staticMarks;
}
