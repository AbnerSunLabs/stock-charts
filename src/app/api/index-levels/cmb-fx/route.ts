import { fetchCmbUsdQuotes } from '@/lib/index-levels/cmb-fx';

/** 牌价一天一更，页面按小时重取。 */
export const revalidate = 60 * 60;

/** 招行美元汇买、汇卖。只读公开牌价，不写入共享行情表。 */
export async function GET(): Promise<Response> {
  try {
    return Response.json(await fetchCmbUsdQuotes());
  } catch {
    return Response.json({ bid: [], ask: [] }, { status: 502 });
  }
}
