'use client';

import dynamic from 'next/dynamic';
import { Empty } from 'antd';
import {
  FOUR_POT_LABELS,
  STRUCTURE_FOUR_POTS,
  type AssetHistoryPoint,
} from '@/types/family-finance';
import { formatCny, formatCompactCny } from '@/lib/family-finance/format';
import { useFamilyAmountVisibility } from '@/components/family/family-amount-visibility';
import { FamilyAmountText } from '@/components/family/family-amount-text';
import { FamilyChartAmountFade } from '@/components/family/family-chart-amount-fade';
import { useFamilyChartAnimate } from '@/components/family/family-motion';

const Line = dynamic(() => import('@ant-design/charts').then(mod => mod.Line), {
  ssr: false,
  /* 状态变化：图表库异步加载占位——骨架扫光统一走 motion-skeleton（--bg-muted 未定义会呈透明洞） */
  loading: () => <div className="motion-skeleton h-[260px] rounded-lg" />,
});

interface FamilyAssetHistoryLineProps {
  title: string;
  points: AssetHistoryPoint[];
}

const HISTORY_COLORS = ['#2563eb', '#10b981', '#f59e0b'] as const;
const HISTORY_LABELS = STRUCTURE_FOUR_POTS.map(pot => FOUR_POT_LABELS[pot]);

const dateFormatter = new Intl.DateTimeFormat('zh-CN', {
  month: '2-digit',
  day: '2-digit',
});

function formatHistoryDate(value: string): string {
  return dateFormatter.format(new Date(`${value}T00:00:00+08:00`));
}

function formatShareRatio(value: number | null): string {
  if (value === null) return '—';
  return new Intl.NumberFormat('zh-CN', {
    style: 'percent',
    maximumFractionDigits: 1,
  }).format(value);
}

function formatTooltipValue(
  point: AssetHistoryPoint,
  amountsVisible: boolean
): string {
  const amountText = formatCny(point.amount, { visible: amountsVisible });
  if (point.latestShareRatio === undefined) return amountText;
  return `${amountText} · 当前占比 ${formatShareRatio(point.latestShareRatio)}`;
}

/**
 * 折线本体：单独成组件以读取 FamilyChartAmountFade 提供的「延迟金额可见性」，
 * Y 轴 / tooltip 的 formatter 在容器淡出到底后才切换（G2 原地 update，不重挂载）。
 */
function AssetHistoryLineChart({
  data,
}: {
  data: Array<AssetHistoryPoint & { type: string }>;
}) {
  const amountsVisible = useFamilyAmountVisibility();
  const chartAnimate = useFamilyChartAnimate();

  return (
    <Line
      data={data}
      xField="date"
      yField="amount"
      colorField="type"
      height={260}
      animate={chartAnimate}
      paddingLeft={64}
      paddingRight={24}
      scale={{
        y: { nice: true },
        color: { domain: HISTORY_LABELS, range: [...HISTORY_COLORS] },
      }}
      axis={{
        x: { title: false, labelFormatter: formatHistoryDate },
        y: {
          title: false,
          labelFormatter: (value: number) =>
            formatCompactCny(Number(value), { visible: amountsVisible }),
        },
      }}
      style={{ lineWidth: 2 }}
      point={{
        size: 4,
        style: { fill: '#fff', lineWidth: 2 },
      }}
      legend={{
        color: {
          position: 'bottom',
          layout: { justifyContent: 'center' },
        },
      }}
      tooltip={{
        title: (datum: AssetHistoryPoint & { type: string }) => datum.date,
        items: [
          (datum: AssetHistoryPoint & { type: string }) => ({
            name: datum.type,
            value: formatTooltipValue(datum, amountsVisible),
          }),
        ],
      }}
    />
  );
}

/** 家庭或单个成员的独立资产历史折线图。 */
export function FamilyAssetHistoryLine({
  title,
  points,
}: FamilyAssetHistoryLineProps) {
  const latestDate = points.reduce(
    (latest, point) => (point.date > latest ? point.date : latest),
    ''
  );
  const latest = points
    .filter(point => point.date === latestDate)
    .reduce((sum, point) => sum + point.amount, 0);
  const data = points.map(point => ({
    ...point,
    type: FOUR_POT_LABELS[point.fourPot],
  }));

  return (
    <div className="family-asset-history-card">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h3 className="m-0 text-sm font-medium">{title}</h3>
        <div className="text-right">
          <div className="family-asset-history-card__summary-label text-xs">
            三笔钱合计
          </div>
          <div className="family-asset-history-card__summary-value family-finance-monetary-value text-sm font-medium">
            {/* 状态变化：金额显隐切换——文本金额 blur+opacity 淡切（同宽掩码防抖动） */}
            <FamilyAmountText amount={latest} />
          </div>
        </div>
      </div>
      {/* 状态变化：空态 ↔ 图表互切——分支 key 仅在有无数据翻转时变化，small 档淡入 */}
      {points.length === 0 ? (
        <div
          key="history-empty"
          className="flex h-[260px] items-center justify-center"
          style={{
            animationName: 'viewFadeIn',
            animationDuration: 'var(--motion-duration-small)',
            animationTimingFunction: 'var(--motion-ease-out)',
          }}
        >
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无历史数据" />
        </div>
      ) : (
        <div
          key="history-chart"
          style={{
            animationName: 'viewFadeIn',
            animationDuration: 'var(--motion-duration-small)',
            animationTimingFunction: 'var(--motion-ease-out)',
          }}
        >
          <FamilyChartAmountFade>
            <AssetHistoryLineChart data={data} />
          </FamilyChartAmountFade>
        </div>
      )}
    </div>
  );
}
