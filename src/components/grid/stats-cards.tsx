"use client";

import { HelpTooltip } from "@/components/shared/help-tooltip";
import type { StressTest } from "@/types/grid";

interface StatsCardsProps {
  stressTest: StressTest;
  /** 隐藏已在主 KPI 行展示的指标，避免重复 */
  omitPrimary?: boolean;
  /** 侧栏紧凑布局：指标卡两列排布 */
  compact?: boolean;
}

interface StatCardItem {
  label: string;
  value: string;
  tooltip?: string | null;
  color?: string | null;
}

export function StatsCards({
  stressTest,
  omitPrimary = false,
  compact = false,
}: StatsCardsProps) {
  const v2 = stressTest.v2;
  const primaryLabels = new Set(
    omitPrimary
      ? v2
        ? ['预计最大投入', '最大单档聚合资金', '推演网格利润', '单格金额']
        : ['总买入金额', '收益率', '预期利润']
      : []
  );

  const fundingCards: StatCardItem[] = v2
    ? [
        {
          label: "预计最大投入",
          value: Math.round(v2.totalBudgetRequired).toLocaleString(),
          tooltip: "所有档位买入成本（含佣金）之和",
        },
        {
          label: "最大单档聚合资金",
          value: Math.round(v2.maxClusterCashDemand).toLocaleString(),
          tooltip: "单个聚合组一次触发的最大资金需求",
        },
      ]
    : [
        {
          label: "总买入金额",
          value: stressTest.totalBuyAmount.toLocaleString(),
          tooltip: null,
        },
      ];

  const profitCards: StatCardItem[] = v2
    ? [
        {
          label: "推演网格利润",
          value:
            (v2.realizedGridProfit > 0 ? "+" : "") +
            Math.round(v2.realizedGridProfit).toLocaleString(),
          color:
            v2.realizedGridProfit > 0
              ? "var(--profit)"
              : v2.realizedGridProfit < 0
                ? "var(--loss)"
                : null,
          tooltip: "假设全档回补后的推演净利润，非成交记账",
        },
        {
          label: "扣费后收益率",
          value:
            (v2.realizedGridProfitRate > 0 ? "+" : "") +
            v2.realizedGridProfitRate.toFixed(2) +
            "%",
          color:
            v2.realizedGridProfitRate > 0
              ? "var(--profit)"
              : v2.realizedGridProfitRate < 0
                ? "var(--loss)"
                : null,
          tooltip: "推演网格利润 / 预计最大投入",
        },
        {
          label: "成本覆盖步长",
          value: `${v2.costCoverageStepPct.toFixed(3)}%`,
          tooltip: "往返成本折算的最小有效步长",
        },
      ]
    : [
        {
          label: "预期利润",
          value:
            (stressTest.profit > 0 ? "+" : "") +
            stressTest.profit.toLocaleString(),
          color:
            stressTest.profit > 0
              ? "var(--profit)"
              : stressTest.profit < 0
                ? "var(--loss)"
                : null,
          tooltip: "利润 = 卖出金额 - 买入金额 + 剩余股数 × 基准价",
        },
        {
          label: "收益率",
          value:
            (stressTest.profitRate > 0 ? "+" : "") + stressTest.profitRate + "%",
          color:
            stressTest.profitRate > 0
              ? "var(--profit)"
              : stressTest.profitRate < 0
                ? "var(--loss)"
                : null,
          tooltip: "利润 / 买入金额 × 100",
        },
      ];

  const baseCards: StatCardItem[] = v2
    ? [
        {
          label: "底仓份额",
          value: v2.basePositionShares.toLocaleString(),
          tooltip: "所有网格累积留利底仓份额",
        },
        {
          label: "底仓成本",
          value: Math.round(v2.basePositionCost).toLocaleString(),
          tooltip: "底仓分摊买入成本（含佣金）",
        },
        {
          label: "底仓浮盈",
          value:
            (v2.basePositionUnrealizedPnL > 0 ? "+" : "") +
            Math.round(v2.basePositionUnrealizedPnL).toLocaleString(),
          color:
            v2.basePositionUnrealizedPnL > 0
              ? "var(--profit)"
              : v2.basePositionUnrealizedPnL < 0
                ? "var(--loss)"
                : null,
          tooltip: "底仓市值 - 底仓成本",
        },
        {
          label: "综合净利润",
          value:
            (v2.totalNetProfit > 0 ? "+" : "") +
            Math.round(v2.totalNetProfit).toLocaleString(),
          color:
            v2.totalNetProfit > 0
              ? "var(--profit)"
              : v2.totalNetProfit < 0
                ? "var(--loss)"
                : null,
          tooltip: "推演网格利润 + 底仓浮盈",
        },
      ]
    : [
        {
          label: "剩余股数",
          value: stressTest.remainingShares.toLocaleString(),
          tooltip: "剩余股数 = 总买入股数 - 总卖出股数",
        },
      ];

  const sections: { title: string; cards: StatCardItem[] }[] = [
    { title: '资金压力', cards: fundingCards },
    { title: '滚动收益', cards: profitCards },
    { title: '底仓', cards: baseCards },
  ]
    .map(section => ({
      ...section,
      cards: section.cards.filter(card => !primaryLabels.has(card.label)),
    }))
    .filter(section => section.cards.length > 0);

  return (
    <div className={compact ? 'space-y-5' : 'mb-8 space-y-6'}>
      {sections.map(section => (
        <div key={section.title}>
          <p className="mb-3 text-xs font-medium text-[var(--muted-foreground)]">
            {section.title}
          </p>
          <div
            className={
              compact
                ? 'grid grid-cols-2 gap-3'
                : 'grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4'
            }
          >
            {section.cards.map((item, i) => (
              <div
                key={`${section.title}-${i}`}
                className="rounded-[var(--radius-compact)] border border-[var(--border)] bg-[color-mix(in_srgb,var(--surface-subtle)_55%,var(--card))] p-4 md:p-5"
              >
                <div className="mb-3 flex items-center gap-1">
                  <span className="text-xs font-medium text-[var(--muted-foreground)]">
                    {item.label}
                  </span>
                  {"tooltip" in item && item.tooltip ? (
                    <HelpTooltip
                      title={item.tooltip}
                      placement="topLeft"
                      maxWidth="13rem"
                    />
                  ) : null}
                </div>
                <div
                  className="text-xl font-light"
                  style={{
                    color: item.color ?? "var(--foreground)",
                    letterSpacing: "-0.01em",
                  }}
                >
                  {item.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
