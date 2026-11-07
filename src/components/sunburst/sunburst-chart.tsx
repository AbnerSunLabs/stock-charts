'use client';

import { useEffect, useMemo, useCallback } from 'react';
import { Sunburst } from '@ant-design/charts';

import { isL1ChartNode, type ChartNode } from '@/utils/sunburst-chart-data';
import { SUNBURST_INNER_RADIUS } from '@/utils/sunburst-visual-config';

interface ChartDatumPayload {
  data?: ChartDatumPayload | {
    name?: string;
    value?: number;
    depth?: number;
    category?: string;
    shares?: number;
    percentage?: string;
  };
  name?: string;
  value?: number;
  depth?: number;
  category?: string;
  shares?: number;
  percentage?: string;
}

const L1_COLOR_MAP: Record<string, string> = {
  A股: '#7c9cb5',
  现金: '#2d8fb3',
  海外新兴: '#e89a7d',
  债券: '#3db5dc',
  海外成熟: '#2ca89e',
};
const DEFAULT_SECTOR_COLOR = '#fff';
const L1_ORDER = ['A股', '海外新兴', '现金', '海外成熟', '债券'] as const;

const CHART_MIN_SIZE = 200;
/* 与容器 max-w 分档（920/1024/1160/1280）对齐：图随视口放大但仍为正方形 */
const CHART_MAX_SIZE = 1280;

function resolveChartSize(width: number, height: number): number {
  const available = Math.floor(Math.min(width, height, CHART_MAX_SIZE));
  return available > 0 ? available : CHART_MIN_SIZE;
}

function getPayloadRaw(payload: ChartDatumPayload): ChartDatumPayload | Record<string, unknown> {
  const inner = payload?.data;
  if (inner && typeof inner === 'object' && 'data' in inner) {
    return (inner as ChartDatumPayload).data ?? inner;
  }
  return inner ?? payload;
}

function readNodeFields(payload: ChartDatumPayload) {
  const raw = getPayloadRaw(payload);
  const name =
    (raw && typeof raw === 'object' && 'name' in raw
      ? (raw as ChartDatumPayload).name
      : payload?.name) ?? '';
  const category =
    (raw && typeof raw === 'object' && 'category' in raw
      ? (raw as ChartDatumPayload).category
      : payload?.category) ?? undefined;
  const value = Number(
    (raw && typeof raw === 'object' && 'value' in raw
      ? (raw as ChartDatumPayload).value
      : payload?.value) ?? 0
  );
  const percentage =
    (raw && typeof raw === 'object' && 'percentage' in raw
      ? (raw as ChartDatumPayload).percentage
      : payload?.percentage) ?? undefined;
  const depth = Number(
    (raw && typeof raw === 'object' && 'depth' in raw
      ? (raw as ChartDatumPayload).depth
      : payload?.depth) ?? 0
  );
  return { name, category, value, percentage, depth };
}

interface SunburstChartProps {
  chartData: ChartNode[];
  chartWrapRef: React.RefObject<HTMLDivElement>;
  chartSize: { width: number; height: number };
  setChartSize: React.Dispatch<React.SetStateAction<{ width: number; height: number }>>;
}

/**
 * 资产配置旭日图渲染块。
 */
export function SunburstChart({
  chartData,
  chartWrapRef,
  chartSize,
  setChartSize,
}: SunburstChartProps) {
  const formatTooltipLabel = useCallback((d: unknown): string => {
    if (!d || typeof d !== 'object') return '—';
    const payload = d as ChartDatumPayload;
    const raw = getPayloadRaw(payload);
    const name =
      (raw && typeof raw === 'object' && 'name' in raw
        ? (raw as ChartDatumPayload).name
        : payload?.name) ?? '—';
    const value = Number(
      (raw && typeof raw === 'object' && 'value' in raw
        ? (raw as ChartDatumPayload).value
        : payload?.value) ?? 0
    );
    const percentage =
      (raw && typeof raw === 'object' && 'percentage' in raw
        ? (raw as ChartDatumPayload).percentage
        : payload?.percentage) ?? undefined;
    const pctText =
      typeof percentage === 'string'
        ? percentage
        : Number.isFinite(value)
          ? `${value.toFixed(2)}%`
          : '';
    return `${String(name)} ${pctText}`.trim() || '—';
  }, []);

  const getLabelText = useCallback((d: unknown): string => {
    const { name, category, value, percentage, depth } = readNodeFields(d as ChartDatumPayload);
    if (!name || name === 'root') return '';
    const pctText =
      typeof percentage === 'string'
        ? percentage
        : Number.isFinite(value)
          ? `${value.toFixed(2)}%`
          : '';
    const isL1 =
      isL1ChartNode(name, category) ||
      depth === 1 ||
      (L1_ORDER as readonly string[]).includes(name);
    // 一级类目始终展示（含 1% 以下的海外成熟等），避免被小占比阈值误隐藏
    if (isL1) {
      return pctText ? `${name}\n${pctText}` : String(name);
    }
    if (value < 1.25) return '';
    if (depth >= 3 && value < 2.4) return name;
    if (pctText) return `${name}\n${pctText}`;
    return String(name);
  }, []);

  useEffect(() => {
    const el = chartWrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0]?.contentRect ?? {};
      if (width != null && height != null) {
        const size = resolveChartSize(width, height);
        setChartSize({ width: size, height: size });
      }
    });
    ro.observe(el);
    const { width, height } = el.getBoundingClientRect();
    if (width && height) {
      const size = resolveChartSize(width, height);
      setChartSize({ width: size, height: size });
    }
    return () => ro.disconnect();
  }, [chartWrapRef, setChartSize]);

  const l1Colors = useMemo(
    () => L1_ORDER.map(name => L1_COLOR_MAP[name] ?? DEFAULT_SECTOR_COLOR),
    []
  );

  const config = useMemo(() => {
    const rootData = { name: 'root', value: 100, children: chartData };
    return {
      data: { value: rootData },
      width: chartSize.width,
      height: chartSize.height,
      innerRadius: SUNBURST_INNER_RADIUS,
      radius: 0.985,
      colorField: 'category' as const,
      color: l1Colors,
      scale: {
        category: { domain: [...L1_ORDER], range: l1Colors },
        color: { domain: [...L1_ORDER], range: l1Colors },
      },
      legend: false as const,
      hierarchyConfig: { field: 'value' as const },
      labels: [
        {
          text: getLabelText,
          transform: [{ type: 'overflowHide' }],
          style: {
            fill: 'white',
            fontSize: (d: unknown) => {
              const { name, category, value } = readNodeFields(d as ChartDatumPayload);
              if (isL1ChartNode(name, category)) return 14;
              if (value >= 12) return 14;
              if (value >= 5) return 12;
              return 10;
            },
            fontWeight: 700,
            lineHeight: 15,
            textAlign: 'center' as const,
          },
        },
      ],
      tooltip: {
        title: (d: unknown): string => {
          try {
            const x = Array.isArray(d) ? d[0] : d;
            return formatTooltipLabel(x);
          } catch {
            return '—';
          }
        },
        items: (): { name: string; value: string }[] => [],
      },
      sunburstStyle: { stroke: '#fff', lineWidth: 1.5 },
      style: { fillOpacity: 1 },
    };
  }, [chartData, chartSize.height, chartSize.width, formatTooltipLabel, getLabelText, l1Colors]);

  return (
    <div
      className="sunburst-chart-wrap relative mx-auto aspect-square w-full max-w-[920px] xl:max-w-[1024px] 2xl:max-w-[1160px] min-[1920px]:max-w-[1280px] bg-[var(--bg-card)] rounded-2xl p-2 border border-[var(--border-subtle)] shadow-[var(--shadow-elevated)] animate-[viewFadeIn_0.6s_var(--ease-out-expo)_0.08s_both] flex items-center justify-center overflow-hidden"
      ref={chartWrapRef}
    >
      <Sunburst {...config} />
    </div>
  );
}
