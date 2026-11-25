'use client';

import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { message } from 'antd';
import { PositionConfigForm } from '@/components/sunburst/position-config-form';
import { LazySunburstChart } from '@/components/sunburst/lazy-sunburst-chart';
import { prefersReducedMotion } from '@/lib/prefers-reduced-motion';
import {
  buildSunburstChartDataFromNodes,
  canGenerateSunburstChart,
} from '@/lib/sunburst/build-sunburst-chart-data';
import type { ChartNode } from '@/utils/sunburst-chart-data';
import { calculatePositionTree, roundAmount } from '@/utils/calculate-position-tree';
import {
  POSITION_CATEGORY_TREE,
} from '@/utils/position-category-tree';

const SUNBURST_BTN_SHARED =
  'py-2 px-4 font-[var(--font-body)] text-sm font-medium rounded-lg cursor-pointer transition-all duration-150 active:translate-y-px disabled:opacity-40 disabled:cursor-not-allowed';
const SUNBURST_BTN_SECONDARY = `${SUNBURST_BTN_SHARED} text-[var(--text-primary)] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:bg-[var(--bg-sidebar-hover)] hover:border-[var(--border-muted)]`;
const SUNBURST_BTN_PRIMARY = `${SUNBURST_BTN_SHARED} text-white bg-[var(--accent)] border border-[var(--accent)] hover:bg-[var(--text-accent-soft)] hover:border-[var(--text-accent-soft)] hover:text-white`;

const EXPORT_FILE_PREFIX = '资产配置-';
const EXPORT_FILE_EXT = '.png';

function formatDateYYYYMMDD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

/**
 * 导出 PNG：先铺白底再绘制 canvas。
 * canvas 中心孔与外圈留白为透明，直接导出会显示为黑底；白底与页面卡片预览一致。
 * 不再叠加额外中心圆，避免遮挡一级类目标签。
 */
function buildSunburstExportUrl(canvas: HTMLCanvasElement): string {
  const cropSize = Math.min(canvas.width, canvas.height);
  const sourceX = Math.max(0, Math.floor((canvas.width - cropSize) / 2));
  const sourceY = Math.max(0, Math.floor((canvas.height - cropSize) / 2));
  const output = document.createElement('canvas');
  output.width = cropSize;
  output.height = cropSize;

  const ctx = output.getContext('2d');
  if (!ctx) {
    throw new Error('无法创建图片导出上下文');
  }

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, cropSize, cropSize);

  ctx.drawImage(
    canvas,
    sourceX,
    sourceY,
    cropSize,
    cropSize,
    0,
    0,
    cropSize,
    cropSize
  );

  return output.toDataURL('image/png');
}

/**
 * 旭日图页面：按分类填写持仓金额，手动生成占比旭日图。
 */
export default function SunburstPage() {
  const [totalInvestment, setTotalInvestment] = useState<number | null>(null);
  const [leafAmounts, setLeafAmounts] = useState<Record<string, number>>({});
  const [chartData, setChartData] = useState<ChartNode[] | null>(null);
  const chartWrapRef = useRef<HTMLDivElement>(null);
  const chartSectionRef = useRef<HTMLElement>(null);
  const [chartSize, setChartSize] = useState({ width: 800, height: 600 });

  /** 已填持仓合计：总额留空时按它作图（系统能判断的不留给用户） */
  const allocatedTotal = useMemo(
    () => Object.values(leafAmounts).reduce((sum, v) => sum + v, 0),
    [leafAmounts]
  );
  const effectiveTotal = totalInvestment ?? allocatedTotal;

  // 计算树必须用有效总额：占比是图表取值依据，按 0 算会得到全 0 的空图
  const { nodes: calculatedNodes, warnings } = useMemo(
    () =>
      calculatePositionTree(POSITION_CATEGORY_TREE, {
        totalInvestment: effectiveTotal,
        leafAmounts,
      }),
    [effectiveTotal, leafAmounts]
  );

  // 生成快照：下载只在图表与当前输入一致时可用，避免拿到旧图
  const chartSnapshotRef = useRef<string>('');
  const chartStale =
    chartData != null &&
    chartSnapshotRef.current !== JSON.stringify({ effectiveTotal, leafAmounts });

  const handleLeafAmountChange = useCallback((path: string, value: number | null) => {
    setLeafAmounts(prev => {
      const next = { ...prev };
      if (value === null || value === 0) {
        delete next[path];
      } else {
        next[path] = roundAmount(value);
      }
      return next;
    });
  }, []);

  const handleTotalInvestmentChange = useCallback((value: number | null) => {
    setTotalInvestment(value === null ? null : roundAmount(value));
  }, []);

  const handleGenerateChart = useCallback(() => {
    const total = totalInvestment ?? allocatedTotal;
    if (!canGenerateSunburstChart(total)) {
      message.error(
        totalInvestment == null
          ? '请先填写持仓金额，或填写总投资额'
          : '请先填写总投资额（大于 0）'
      );
      return;
    }
    if (allocatedTotal <= 0) {
      message.error('请至少填写一项持仓金额');
      return;
    }
    if (totalInvestment != null && allocatedTotal > totalInvestment) {
      // 超额时阻止生成：表单已有警告，不让错误状态进入图表
      message.error('持仓合计超过总投资额，请调整金额后生成');
      return;
    }
    chartSnapshotRef.current = JSON.stringify({ effectiveTotal, leafAmounts });
    const data = buildSunburstChartDataFromNodes(calculatedNodes, total);
    if (data.length === 0) {
      // 兜底：占比全零等异常情况下不假装生成成功
      message.error('没有可生成的持仓数据，请检查已填金额');
      return;
    }
    setChartData(data);
    message.success(
      totalInvestment == null ? '图表已生成（按持仓合计作图）' : '图表已生成'
    );
  }, [
    totalInvestment,
    allocatedTotal,
    effectiveTotal,
    leafAmounts,
    calculatedNodes,
  ]);

  useEffect(() => {
    if (!chartData?.length) return;
    const timer = window.setTimeout(() => {
      // 系统"减少动态效果"时直接跳转，不做平滑滚动
      chartSectionRef.current?.scrollIntoView({
        behavior: prefersReducedMotion() ? 'auto' : 'smooth',
        block: 'center',
      });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [chartData]);

  const handleDownloadPng = useCallback(() => {
    const wrap = chartWrapRef.current;
    if (!wrap) {
      message.info('图表正在准备，请稍候再下载');
      return;
    }
    const canvas = wrap.querySelector('canvas');
    if (!canvas) {
      message.info('图表正在准备，请稍候再下载');
      return;
    }
    try {
      const url = buildSunburstExportUrl(canvas);
      const dateStr = formatDateYYYYMMDD(new Date());
      const a = document.createElement('a');
      a.href = url;
      a.download = `${EXPORT_FILE_PREFIX}${dateStr}${EXPORT_FILE_EXT}`;
      a.click();
      message.success('图片已下载');
    } catch {
      message.error('下载失败，请重试');
    }
  }, []);

  return (
    <div className="sunburst-page min-h-[60vh] flex flex-col w-full text-[var(--text-primary)]">
      <PositionConfigForm
        totalInvestment={totalInvestment}
        onTotalInvestmentChange={handleTotalInvestmentChange}
        leafAmounts={leafAmounts}
        onLeafAmountChange={handleLeafAmountChange}
        calculatedNodes={calculatedNodes}
        warnings={warnings}
      />

      <section
        className="mb-6 flex flex-wrap gap-2 items-center [&_button]:flex-1 sm:[&_button]:flex-none sm:min-w-[7rem]"
        aria-label="图表操作"
      >
        <button
          type="button"
          className={SUNBURST_BTN_PRIMARY}
          onClick={handleGenerateChart}
        >
          {chartData ? '重新生成图表' : '生成图表'}
        </button>
        <button
          type="button"
          className={SUNBURST_BTN_SECONDARY}
          onClick={handleDownloadPng}
          disabled={!chartData?.length || chartStale}
          title={chartStale ? '金额已修改，重新生成后可下载' : undefined}
        >
          下载图表 PNG
        </button>
        {chartStale ? (
          <span className="text-xs text-[var(--text-muted)]">
            金额已修改，重新生成后可下载
          </span>
        ) : null}
      </section>

      {chartData?.length ? (
        <section ref={chartSectionRef} aria-label="旭日图预览">
          <LazySunburstChart
            chartData={chartData}
            chartWrapRef={chartWrapRef}
            chartSize={chartSize}
            setChartSize={setChartSize}
          />
        </section>
      ) : (
        <div className="flex-1 flex items-center justify-center min-h-[min(280px,50vh)] p-4 sm:p-8 bg-[var(--bg-card)] border border-dashed border-[var(--border-muted)] rounded-2xl">
          <p className="m-0 text-[0.9375rem] text-[var(--text-muted)] text-center max-w-[40ch]">
            填写总投资额与各分类持仓金额后，点击「生成图表」查看旭日图。
          </p>
        </div>
      )}
    </div>
  );
}
