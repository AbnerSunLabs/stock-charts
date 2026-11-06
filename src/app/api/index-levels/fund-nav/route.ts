import { fetchFundNavSeries, fundNavScriptUrl } from '@/lib/index-levels/fund-nav';

/** 场外基金单位净值。只服务页面上点名的代码。 */
export async function GET(request: Request): Promise<Response> {
  const code = new URL(request.url).searchParams.get('code') ?? '';
  if (!fundNavScriptUrl(code)) {
    return Response.json({ points: [] }, { status: 404 });
  }
  try {
    const points = await fetchFundNavSeries(code);
    return Response.json({ points });
  } catch {
    return Response.json({ points: [] }, { status: 502 });
  }
}
