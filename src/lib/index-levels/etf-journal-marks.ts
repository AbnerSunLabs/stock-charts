import { extractEtfCode } from '@/lib/grid/grid-board-close-quote';
import type { EtfTradeMark } from '@/lib/index-levels/media-etf-trades';

/** 点位页上跟网格流水走的场内代码。 */
export const JOURNAL_LINKED_ETF = '563360';

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

/** 563360 已登录用流水；还在读时先不画，未登录用写死的快照。其余 ETF 仍用快照。 */
export function resolveEtfChartMarks(
  code: string | undefined,
  journal: EtfJournalMarks,
  staticMarks: EtfTradeMark[]
): EtfTradeMark[] {
  if (code !== JOURNAL_LINKED_ETF) return staticMarks;
  if (journal.status === 'live') return journal.marks;
  if (journal.status === 'pending') return [];
  return staticMarks;
}
