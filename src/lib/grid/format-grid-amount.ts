import { getPriceDecimals } from '@/lib/grid-validate-params';

/**
 * 网格金额展示：最多两位小数，整数不补 .00。
 */
export function formatGridAmount(value: number): string {
  if (!Number.isFinite(value)) return '—';
  const rounded = Math.round((value + Number.EPSILON) * 100) / 100;
  return rounded.toLocaleString('zh-CN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  });
}

/**
 * 带正负号的网格金额（正数前加 +）。
 */
export function formatSignedGridAmount(value: number): string {
  const body = formatGridAmount(value);
  return value > 0 ? `+${body}` : body;
}

/**
 * 网格报价展示：按最小报价单位保留位数，不截成金额两位。
 */
export function formatGridPrice(price: number, priceUnit: number): string {
  if (!Number.isFinite(price)) return '—';
  return price.toFixed(getPriceDecimals(priceUnit));
}
