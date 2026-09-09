'use client';

/**
 * 策略对比折线图：网格策略 vs 一次全仓死拿的浮亏对比（recharts）。
 */

import { TOOLTIP_Z_INDEX } from '@/components/shared/help-tooltip';
import {
  buildStrategyComparisonData,
  computeTooltipMetrics,
  type StrategyComparisonPoint,
} from '@/lib/strategy-comparison';
import type { GridRow } from '@/types/grid';
import { useEffect, useMemo, useState } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface StrategyComparisonChartProps {
  gridData: GridRow[];
  basePrice: number;
  priceDecimals: number;
}

interface ChartColors {
  lumpSum: string;
  grid: string;
  text: string;
  textLight: string;
  gridLine: string;
  tooltipBg: string;
  tooltipBorder: string;
  buyPoint: string;
  buyPointBorder: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: StrategyComparisonPoint }>;
  colors: ChartColors;
  priceDecimals: number;
}

/** 与 `.grid-shell` token 对齐的图表色（recharts 需实色字符串） */
const CHART_COLORS: ChartColors = {
  lumpSum: '#cf202f', // --loss
  grid: '#05b169', // --profit
  text: '#0a0b0d', // --foreground
  textLight: '#5b616e', // --muted-foreground
  gridLine: '#dee1e6', // --border
  tooltipBg: '#ffffff', // --card
  tooltipBorder: '#dee1e6', // --border
  buyPoint: '#0052ff', // --accent
  buyPointBorder: '#003ecc', // --accent-secondary
};

function formatBreakEvenRise(value: number): string {
  if (!Number.isFinite(value)) return '无法回本';
  return `+${value.toFixed(1)}%`;
}

function CustomTooltip({
  active,
  payload,
  colors,
  priceDecimals,
}: CustomTooltipProps) {
  if (!active || !payload || !payload.length) return null;

  const data: StrategyComparisonPoint | undefined = payload[0]?.payload;
  if (!data) return null;

  const {
    lumpSumDropRate,
    lumpSumLossAmount,
    lumpSumBreakEvenRise,
    gridDropRate,
    gridLossAmount,
    gridBreakEvenRise,
    lessLoss,
    breakEvenThreshold,
  } = computeTooltipMetrics(data);

  return (
    <div
      className="grid-chart-tooltip"
      style={{
        backgroundColor: colors.tooltipBg,
        borderColor: colors.tooltipBorder,
        zIndex: TOOLTIP_Z_INDEX,
      }}
    >
      <div className="grid-chart-tooltip__head">
        <span className="grid-chart-tooltip__eyebrow">
          档位 {data.gridPosition.toFixed(2)}
        </span>
        <div className="grid-chart-tooltip__title">
          买入触发价 {data.priceLabel}
        </div>
        <div className="grid-chart-tooltip__meta">
          买入价 ¥{data.gridBuyPrice.toFixed(priceDecimals)} ·{' '}
          {data.gridBuyShares.toLocaleString()} 股 · ¥
          {data.gridBuyAmount.toLocaleString()}
        </div>
      </div>

      <div className="grid-chart-tooltip__block">
        <div className="grid-chart-tooltip__series">
          <span
            className="grid-chart-tooltip__swatch"
            style={{ background: colors.lumpSum }}
          />
          一次全仓死拿
        </div>
        <div className="grid-chart-tooltip__value-row">
          <span
            className="grid-chart-tooltip__value"
            style={{ color: colors.lumpSum }}
          >
            -¥{Math.abs(lumpSumLossAmount / 1000).toFixed(1)}k
          </span>
          <span className="grid-chart-tooltip__muted">
            (跌幅 -{Math.abs(lumpSumDropRate).toFixed(1)}%)
          </span>
        </div>
        <div className="grid-chart-tooltip__muted">
          回本需涨{' '}
          <span className="font-semibold" style={{ color: colors.lumpSum }}>
            {formatBreakEvenRise(lumpSumBreakEvenRise)}
          </span>
        </div>
      </div>

      <div className="grid-chart-tooltip__block">
        <div className="grid-chart-tooltip__series">
          <span
            className="grid-chart-tooltip__swatch"
            style={{ background: colors.grid }}
          />
          本策略
        </div>
        <div className="grid-chart-tooltip__value-row">
          <span
            className="grid-chart-tooltip__value"
            style={{ color: colors.grid }}
          >
            -¥{Math.abs(gridLossAmount / 1000).toFixed(1)}k
          </span>
          <span className="grid-chart-tooltip__muted">
            (跌幅 -{Math.abs(gridDropRate).toFixed(1)}%)
          </span>
        </div>
        <div className="grid-chart-tooltip__muted">
          回本需涨{' '}
          <span className="font-semibold" style={{ color: colors.grid }}>
            {formatBreakEvenRise(gridBreakEvenRise)}
          </span>
        </div>
      </div>

      <div className="grid-chart-tooltip__foot">
        <div className="grid-chart-tooltip__series">策略优势</div>
        <div className="grid-chart-tooltip__advantage">
          <span>
            少亏{' '}
            <strong style={{ color: colors.grid }}>
              ¥{Math.abs(lessLoss / 1000).toFixed(1)}k
            </strong>
          </span>
          <span className="grid-chart-tooltip__dot" aria-hidden>
            ·
          </span>
          <span>
            回本门槛{' '}
            <strong style={{ color: colors.grid }}>
              -{Math.abs(breakEvenThreshold).toFixed(1)}%
            </strong>
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * 策略优势推演折线图。
 */
export function StrategyComparisonChart({
  gridData,
  basePrice,
  priceDecimals,
}: StrategyComparisonChartProps) {
  const [isCompactChart, setIsCompactChart] = useState(false);
  const colors = CHART_COLORS;

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 767px)');
    const update = () => setIsCompactChart(mediaQuery.matches);
    update();
    mediaQuery.addEventListener('change', update);
    return () => mediaQuery.removeEventListener('change', update);
  }, []);

  const chartData = useMemo(
    () => buildStrategyComparisonData(gridData, basePrice, priceDecimals),
    [gridData, basePrice, priceDecimals]
  );

  if (chartData.length === 0) return null;

  const chartMargin = isCompactChart
    ? { top: 16, right: 12, left: 0, bottom: 48 }
    : { top: 20, right: 30, left: 20, bottom: 60 };
  const xAxisTick = isCompactChart
    ? { fill: colors.textLight, fontSize: 10 }
    : { fill: colors.textLight, fontSize: 12 };
  const yAxisTick = isCompactChart
    ? { fill: colors.textLight, fontSize: 10 }
    : { fill: colors.textLight, fontSize: 12 };

  function formatYAxis(value: number) {
    if (value === 0) return '0%';
    return `${value.toFixed(0)}%`;
  }

  return (
    <div className="w-full">
      <div className="mb-5 border-b border-[var(--border)] pb-4">
        <h3 className="ds-section-title">策略优势推演</h3>
        <p className="mt-1 text-xs text-[var(--muted-foreground)]">
          模拟单边下跌：一次全仓死拿 vs 本策略的浮亏差距；同展示价合并为一档，横轴按档位等距
        </p>
      </div>

      <div className="h-[360px] w-full sm:h-[440px] md:h-[520px] xl:h-[560px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={chartMargin}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={colors.gridLine}
              opacity={0.45}
            />
            <XAxis
              dataKey="priceLabel"
              stroke={colors.textLight}
              tick={xAxisTick}
              {...(isCompactChart
                ? {
                    angle: -35,
                    textAnchor: 'end' as const,
                    height: 50,
                    interval: 'preserveStartEnd' as const,
                  }
                : { tickCount: 6 })}
              label={{
                value: '股价',
                position: 'insideBottom',
                offset: -10,
                style: { fill: colors.text, fontSize: 13, fontWeight: 500 },
              }}
            />
            <YAxis
              stroke={colors.textLight}
              tick={yAxisTick}
              width={isCompactChart ? 40 : undefined}
              tickFormatter={formatYAxis}
              domain={[(dataMin: number) => Math.floor(dataMin * 1.1), 0]}
              label={{
                value: '浮动盈亏（%）',
                angle: -90,
                position: 'insideLeft',
                style: { fill: colors.text, fontSize: 13, fontWeight: 500 },
              }}
            />
            <Tooltip
              content={props => (
                <CustomTooltip
                  {...props}
                  colors={colors}
                  priceDecimals={priceDecimals}
                />
              )}
              wrapperStyle={{ zIndex: TOOLTIP_Z_INDEX }}
            />
            <Legend
              wrapperStyle={{
                paddingTop: '20px',
                fontSize: '13px',
                color: colors.textLight,
              }}
              iconType="line"
            />

            <Line
              type="linear"
              dataKey="lumpSumFloatingLossRate"
              stroke={colors.lumpSum}
              strokeWidth={1.5}
              strokeDasharray="8 4"
              dot={false}
              name="一次全仓死拿"
              activeDot={{ r: 5 }}
            />

            <Line
              type="linear"
              dataKey="gridFloatingLossRate"
              stroke={colors.grid}
              strokeWidth={2}
              name="本策略"
              dot={(props: {
                cx?: number;
                cy?: number;
                payload?: StrategyComparisonPoint;
              }) => {
                const { cx = 0, cy = 0 } = props;
                return (
                  <g>
                    <circle
                      cx={cx}
                      cy={cy}
                      r={7}
                      fill={colors.buyPointBorder}
                      opacity={0.28}
                    />
                    <circle
                      cx={cx}
                      cy={cy}
                      r={5}
                      fill={colors.buyPoint}
                      stroke="#ffffff"
                      strokeWidth={2}
                      style={{ cursor: 'pointer' }}
                    />
                  </g>
                );
              }}
              activeDot={{
                r: 7,
                fill: colors.buyPoint,
                stroke: '#ffffff',
                strokeWidth: 2,
              }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
