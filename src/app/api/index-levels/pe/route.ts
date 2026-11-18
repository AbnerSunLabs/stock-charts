import { INDEX_WATCHES } from "@/lib/index-levels/catalog";
import { fetchCsindexPe } from "@/lib/index-levels/csindex-pe";
import { csindexSymbol } from "@/lib/index-levels/pe-series";

/** 点位跟踪页用的滚动市盈率。只服务名单里的指数，不落库。 */
export async function GET(request: Request): Promise<Response> {
  const code = new URL(request.url).searchParams.get("code") ?? "";
  const watched = INDEX_WATCHES.some((item) => item.code === code);
  if (!watched || !csindexSymbol(code)) {
    return Response.json({ points: [] });
  }
  try {
    const points = await fetchCsindexPe(code);
    return Response.json(
      { points },
      { headers: { "Cache-Control": "public, max-age=21600" } },
    );
  } catch {
    return Response.json({ points: [] }, { status: 502 });
  }
}
