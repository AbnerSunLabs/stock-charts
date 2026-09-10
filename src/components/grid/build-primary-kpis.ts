import {
  formatGridAmount,
  formatSignedGridAmount,
} from '@/lib/grid/format-grid-amount';
import type { StressTest } from '@/types/grid';

/** 网格页 KPI 展示项 */
export interface GridKpiItem {
  label: string;
  value: string;
  tooltip?: string | null;
  color?: string | null;
}

function toneBySign(value: number): string | null {
  if (value > 0) return 'var(--profit)';
  if (value < 0) return 'var(--loss)';
  return null;
}

/**
 * 从压力测试结果映射结果态顶部主 KPI（V2 四卡 / legacy 三卡）。
 */
export function buildPrimaryKpis(stressTest: StressTest): GridKpiItem[] {
  const v2 = stressTest.v2;
  if (!v2) {
    return [
      {
        label: '总买入金额',
        value: formatGridAmount(stressTest.totalBuyAmount),
        tooltip: null,
      },
      {
        label: '收益率',
        value:
          (stressTest.profitRate > 0 ? '+' : '') + stressTest.profitRate + '%',
        color: toneBySign(stressTest.profitRate),
        tooltip: '利润 / 买入金额 × 100',
      },
      {
        label: '预期利润',
        value: formatSignedGridAmount(stressTest.profit),
        color: toneBySign(stressTest.profit),
        tooltip: '利润 = 卖出金额 - 买入金额 + 剩余股数 × 基准价',
      },
    ];
  }

  return [
    {
      label: '预计最大投入',
      value: formatGridAmount(v2.totalBudgetRequired),
      tooltip: '所有档位买入成本（含佣金）之和',
    },
    {
      label: '最大单档聚合资金',
      value: formatGridAmount(v2.maxClusterCashDemand),
      tooltip: '单个聚合组一次触发的最大资金需求',
    },
    {
      label: '推演网格利润',
      value: formatSignedGridAmount(v2.realizedGridProfit),
      color: toneBySign(v2.realizedGridProfit),
      tooltip: '假设全档回补后的推演净利润，非成交记账',
    },
    {
      label: '单格金额',
      value: formatGridAmount(v2.amountPerGrid),
      tooltip: '当前策略使用的单格基础金额',
    },
  ];
}
