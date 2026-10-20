/**
 * A 股日 K 是否已是收盘。
 * 同步任务在 15:00 前可能把 Yahoo 盘中价写成当日 trade_date，这类行不能当收盘。
 */

const CLOSE_HOUR = 15;

function parseTimestamp(value: string): number {
  const text = value.includes('T') ? value : value.replace(' ', 'T');
  return Date.parse(text);
}

/**
 * 写入时间不早于该交易日上海时间 15:00，才视为收盘价。
 */
export function isSettledAshareClose(tradeDate: string, updatedAt: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tradeDate)) return false;
  const updated = parseTimestamp(updatedAt);
  const closeAt = Date.parse(`${tradeDate}T${String(CLOSE_HOUR).padStart(2, '0')}:00:00+08:00`);
  if (Number.isNaN(updated) || Number.isNaN(closeAt)) return false;
  return updated >= closeAt;
}
