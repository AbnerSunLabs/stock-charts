'use client';

import dynamic from 'next/dynamic';
import type { ComponentProps, ComponentType } from 'react';
import type { SunburstChart } from '@/components/sunburst/sunburst-chart';

/**
 * 图表库体积大，仅在生成图表后按需加载，避免进入页面首包与 SSR vendor chunk。
 */
export const LazySunburstChart = dynamic(
  () =>
    import('@/components/sunburst/sunburst-chart').then(mod => ({
      default: mod.SunburstChart,
    })),
  {
    ssr: false,
    loading: () => (
      /* 状态变化：图表库异步加载占位——外框对齐图表容器（实线卡片），骨架扫光统一走
         motion-skeleton（reduced-motion 下由全局兜底静态化），文案按加载中规范 */
      <div className="flex min-h-[min(360px,50vh)] flex-col items-center justify-center gap-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-8">
        <div className="motion-skeleton h-24 w-24 rounded-full" aria-hidden />
        <p className="m-0 text-sm font-medium text-[var(--text-muted)]">正在加载图表…</p>
      </div>
    ),
  }
) as ComponentType<ComponentProps<typeof SunburstChart>>;
