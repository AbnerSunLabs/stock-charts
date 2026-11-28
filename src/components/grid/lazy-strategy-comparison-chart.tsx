"use client";

import dynamic from "next/dynamic";

/**
 * 策略对比图为 Recharts 重模块，按需加载避免进入 grid 首包。
 */
export const LazyStrategyComparisonChart = dynamic(
  () =>
    import("@/components/grid/strategy-comparison-chart").then((m) => ({
      default: m.StrategyComparisonChart,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[360px] flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-[var(--border)] bg-[color-mix(in_srgb,var(--surface-subtle)_65%,var(--card))] px-8">
        <div
          className="h-9 w-9 animate-pulse rounded-full bg-[color-mix(in_srgb,var(--accent)_20%,transparent)]"
          aria-hidden
        />
        <p className="text-sm font-medium text-[var(--muted-foreground)]">
          正在加载图表…
        </p>
      </div>
    ),
  }
);
