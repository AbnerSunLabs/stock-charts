/** @jest-environment node */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('FamilyBalanceTrendChart source contract', () => {
  const source = readFileSync(
    join(process.cwd(), 'src/components/family/family-balance-trend-chart.tsx'),
    'utf8'
  );

  it('默认范围为近 90 天，并提供空态文案', () => {
    expect(source).toContain("useState<BalanceTrendRange>('90d')");
    expect(source).toContain('暂无历史趋势，更新资产后将按日累计');
    expect(source).toContain('该范围内暂无数据');
    expect(source).toContain("defaultSelect: ['总资产', '总负债']");
    expect(source).toContain('family-balance-trend-chart-body');
    expect(source).toContain('ResizeObserver');
    expect(source).toContain('seriesField="type"');
    expect(source).toContain('colorField="type"');
    // 金额显隐：图表区由 FamilyChartAmountFade 统一原地淡切，
    // Y 轴 / tooltip 文案走 formatter 遮罩（G2 update 通道），不再 key 重挂载整图
    expect(source).toContain('FamilyChartAmountFade');
    expect(source).toContain('useFamilyAmountVisibility');
    expect(source).toContain('labelFormatter: formatYAxisLabel');
    expect(source).toContain('formatCny(datum.amount, { visible: amountsVisible })');
    // 防回退到 key={amountsVisible} 重挂载方案（图例点选状态会随之丢失）
    expect(source).not.toContain('key={amountsVisible');
  });
});

describe('FamilyOverviewPage KPI trend layout contract', () => {
  const source = readFileSync(
    join(process.cwd(), 'src/components/family/family-overview-page.tsx'),
    'utf8'
  );

  it('总览 KPI 行挂载趋势图并并行拉取快照', () => {
    expect(source).toContain('FamilyBalanceTrendChart');
    expect(source).toContain('listBalanceSnapshots');
    expect(source).toContain('family-overview-kpi-stack');
    expect(source).toContain('lg={8}');
    expect(source).toContain('lg={16}');
  });
});
