'use client';

import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { message } from 'antd';
import { PositionConfigForm } from '@/components/sunburst/position-config-form';
import { LazySunburstChart } from '@/components/sunburst/lazy-sunburst-chart';
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

  const { nodes: calculatedNodes, warnings } = useMemo(
    () =>
      calculatePositionTree(POSITION_CATEGORY_TREE, {
        totalInvestment: totalInvestment ?? 0,
        leafAmounts,
      }),
    [totalInvestment, leafAmounts]
  );

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
    const total = totalInvestment ?? 0;
    if (!canGenerateSunburstChart(total)) {
      message.error('请先填写总投资额（大于 0）');
      return;
    }
    setChartData(buildSunburstChartDataFromNodes(calculatedNodes, total));
    message.success('图表已生成');
  }, [totalInvestment, calculatedNodes]);

  useEffect(() => {
    if (!chartData?.length) return;
    const timer = window.setTimeout(() => {
      chartSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [chartData]);

  const handleDownloadPng = useCallback(() => {
    const wrap = chartWrapRef.current;
    if (!wrap) {
      message.error('图表区域未就绪，请重试');
      return;
    }
    const canvas = wrap.querySelector('canvas');
    if (!canvas) {
      message.error('请先生成图表后再下载');
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
    <div className="sunburst-page min-h-[60vh] flex flex-col w-full max-w-[var(--page-max)] mx-auto text-[var(--text-primary)]">
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
          生成图表
        </button>
        <button
          type="button"
          className={SUNBURST_BTN_SECONDARY}
          onClick={handleDownloadPng}
          disabled={!chartData?.length}
        >
          下载 PNG
        </button>
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
