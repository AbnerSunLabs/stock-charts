import { INDEX_WATCHES } from "@/lib/index-levels/catalog";
import { fetchCsindexPe } from "@/lib/index-levels/csindex-pe";
import { asPePoints, csindexSymbol, type PePoint } from "@/lib/index-levels/pe-series";

const DEPLOYED_PE_API = "https://charts-stock.vercel.app/api/index-levels/pe";

/** 本机无法连接中证官网时，开发环境从同项目已上线的只读接口补数。 */
async function fetchDevelopmentFallback(code: string): Promise<PePoint[]> {
  const response = await fetch(
    `${DEPLOYED_PE_API}?code=${encodeURIComponent(code)}`,
    { cache: "no-store" },
  );
  if (!response.ok) throw new Error(`已上线 PE 接口请求失败：${response.status}`);
  const body: unknown = await response.json();
  const points = asPePoints((body as { points?: unknown } | null)?.points);
  if (points.length === 0) throw new Error("已上线 PE 接口没有有效数据");
  return points;
}

/** 点位跟踪页用的滚动市盈率。只服务名单里的指数，不落库。 */
export async function GET(request: Request): Promise<Response> {
  const code = new URL(request.url).searchParams.get("code") ?? "";
  const watched = INDEX_WATCHES.some((item) => item.code === code);
  if (!watched || !csindexSymbol(code)) {
    return Response.json({ points: [] });
  }
  try {
    let points: PePoint[];
    try {
      points = await fetchCsindexPe(code);
    } catch (error) {
      if (process.env.NODE_ENV !== "development") throw error;
      points = await fetchDevelopmentFallback(code);
    }
    return Response.json(
      { points },
      { headers: { "Cache-Control": "public, max-age=21600" } },
    );
  } catch {
    return Response.json({ points: [] }, { status: 502 });
  }
}
