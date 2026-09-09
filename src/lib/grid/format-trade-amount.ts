/**
 * 记账弹窗成交额展示。
 */
export function formatTradeAmount(
  price: number | undefined,
  qty: number | undefined
): string {
  const amount = Number(price) * Number(qty);
  if (!Number.isFinite(amount) || amount <= 0) return '—';
  return amount.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
