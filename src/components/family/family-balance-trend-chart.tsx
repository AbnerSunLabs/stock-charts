'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import dynamic from 'next/dynamic';
import { Card, Empty, Segmented } from 'antd';
import {
  filterBalanceSnapshots,
  shanghaiTodayIso,
  toBalanceTrendSeries,
} from '@/lib/family-finance/balance-trend';
import { formatCompactCny, formatCny } from '@/lib/family-finance/format';
import { useFamilyAmountVisibility } from '@/components/family/family-amount-visibility';
import { FamilyChartAmountFade } from '@/components/family/family-chart-amount-fade';
import { useFamilyChartAnimate } from '@/components/family/family-motion';
import {
  BALANCE_TREND_TYPES,
  type BalanceTrendPoint,
  type BalanceTrendRange,
  type FamilyBalanceSnapshot,
} from '@/types/family-finance';

const Line = dynamic(() => import('@ant-design/charts').then(mod => mod.Line), {
  ssr: false,
  /* 状态变化：图表库异步加载占位——骨架扫光统一走 motion-skeleton（--bg-muted 未定义会呈透明洞） */
  loading: () => <div className="motion-skeleton h-full min-h-[220px] rounded-lg" />,
});

const RANGE_OPTIONS: { label: string; value: BalanceTrendRange }[] = [
  { label: '近90天', value: '90d' },
  { label: '近1年', value: '1y' },
  { label: '全部', value: 'all' },
];

const TREND_COLORS = ['#0052ff', '#7c828a', '#05b169'] as const;

/** 容器高度变化的重绘防抖（审计建议 ~150ms），窗口 resize 时合并为一次重绘 */
const CONTAINER_HEIGHT_DEBOUNCE_MS = 150;

const dateFormatter = new Intl.DateTimeFormat('zh-CN', {
  month: '2-digit',
  day: '2-digit',
});

function formatTrendDate(value: string): string {
  return dateFormatter.format(new Date(`${value}T00:00:00+08:00`));
}

/** 跟踪容器高度，使折线填满 KPI 行拉伸后的卡片。 */
function useContainerHeight(): [RefObject<HTMLDivElement>, number] {
  const ref = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(360);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const commit = () => {
      timerRef.current = null;
      const next = Math.max(360, Math.floor(el.getBoundingClientRect().height));
      // 忽略亚像素抖动，避免反复改 height 导致 G2 折线路径错位
      setHeight(prev => (Math.abs(prev - next) < 8 ? prev : next));
    };
    // 首次立即量取；后续尺寸变化经 debounce 合并，避免 resize 连续触发整图重绘
    commit();
    const observer = new ResizeObserver(() => {
      if (timerRef.current != null) return;
      timerRef.current = window.setTimeout(commit, CONTAINER_HEIGHT_DEBOUNCE_MS);
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
      if (timerRef.current != null) window.clearTimeout(timerRef.current);
    };
  }, []);

  return [ref, height];
}

interface FamilyBalanceTrendChartProps {
  points: FamilyBalanceSnapshot[];
  loading: boolean;
}

/**
 * 折线本体：单独成组件以读取 FamilyChartAmountFade 提供的「延迟金额可见性」，
 * Y 轴 / tooltip 的 formatter 在容器淡出到底后才切换（G2 原地 update，不重挂载，
 * 图例点选状态全程保留）。
 */
function TrendLineChart({
  series,
  chartHeight,
}: {
  series: ReturnType<typeof toBalanceTrendSeries>;
  chartHeight: number;
}) {
  const amountsVisible = useFamilyAmountVisibility();
  const chartAnimate = useFamilyChartAnimate();
  const formatYAxisLabel = useCallback(
    (value: number) => formatCompactCny(Number(value), { visible: amountsVisible }),
    [amountsVisible]
  );

  return (
    <Line
      data={series}
      xField="date"
      yField="amount"
      // color 只着色；series 负责按类型拆线
      seriesField="type"
      colorField="type"
      height={chartHeight}
      autoFit
      animate={chartAnimate}
      paddingLeft={56}
      paddingRight={16}
      scale={{
        y: { nice: true },
        color: {
          domain: [...BALANCE_TREND_TYPES],
          range: [...TREND_COLORS],
        },
      }}
      axis={{
        x: { title: false, labelFormatter: formatTrendDate },
        y: {
          title: false,
          labelFormatter: formatYAxisLabel,
        },
      }}
      style={{ lineWidth: 2 }}
      point={{
        size: 3,
        style: { fill: '#fff', lineWidth: 2 },
      }}
      legend={{
        color: {
          position: 'bottom',
          layout: { justifyContent: 'center' },
          // G2 v5：初始仅选中总资产/总负债；净资产靠图例点选显示
          defaultSelect: ['总资产', '总负债'],
        },
      }}
      tooltip={{
        title: (datum: BalanceTrendPoint) => datum.date,
        items: [
          (datum: BalanceTrendPoint) => ({
            name: datum.type,
            value: formatCny(datum.amount, { visible: amountsVisible }),
          }),
        ],
      }}
    />
  );
}

/**
 * 总览 KPI 区资产负债趋势：可切换时间范围，图例可显示净资产。
 * 卡片高度随左侧三张 KPI 拉伸对齐，折线区域自适应填满。
 *
 * 金额隐藏时：tooltip / Y 轴文案遮罩，但几何仍用真实数值；
 * 必须设 seriesField，否则多系列折线会串线。
 * 显隐切换不再 key 重挂载整图：图表区由 FamilyChartAmountFade 统一淡切，
 * 标题与范围切换器保持稳定。
 */
export function FamilyBalanceTrendChart({
  points,
  loading,
}: FamilyBalanceTrendChartProps) {
  const [range, setRange] = useState<BalanceTrendRange>('90d');
  const asOfDate = useMemo(() => shanghaiTodayIso(), []);
  const [chartBodyRef, chartHeight] = useContainerHeight();

  const filtered = useMemo(
    () => filterBalanceSnapshots(points, range, asOfDate),
    [points, range, asOfDate]
  );
  const series = useMemo(() => toBalanceTrendSeries(filtered), [filtered]);

  const emptyDescription =
    points.length === 0
      ? '暂无历史趋势，更新资产后将按日累计'
      : '该范围内暂无数据';

  const hasData = filtered.length > 0;

  return (
    <Card
      loading={loading}
      className="family-finance-section-card family-balance-trend-card"
      title={
        <div className="family-balance-trend-card__header">
          <h2 className="family-finance-section__title">资产负债趋势</h2>
          {/* 状态变化：范围切换（Segmented）——滑块走 antd motion token，图表数据更新统一 240ms */}
          <Segmented
            size="small"
            value={range}
            options={RANGE_OPTIONS}
            onChange={value => setRange(value as BalanceTrendRange)}
          />
        </div>
      }
    >
      <div ref={chartBodyRef} className="family-balance-trend-chart-body">
        {/* 状态变化：空态 ↔ 图表互切——分支 key 只在有无数据翻转时变化（small 档淡入），范围间切换不重挂载 */}
        {hasData ? (
          <div
            key="trend-chart"
            className="h-full"
            style={{
              animationName: 'viewFadeIn',
              animationDuration: 'var(--motion-duration-small)',
              animationTimingFunction: 'var(--motion-ease-out)',
            }}
          >
            <FamilyChartAmountFade>
              <TrendLineChart series={series} chartHeight={chartHeight} />
            </FamilyChartAmountFade>
          </div>
        ) : (
          <div
            key="trend-empty"
            className="flex h-full min-h-[360px] items-center justify-center"
            style={{
              animationName: 'viewFadeIn',
              animationDuration: 'var(--motion-duration-small)',
              animationTimingFunction: 'var(--motion-ease-out)',
            }}
          >
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyDescription} />
          </div>
        )}
      </div>
    </Card>
  );
}
