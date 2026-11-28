'use client';

import { useEffect, useState, type ReactNode } from 'react';
import {
  FamilyAmountVisibilityProvider,
  useFamilyAmountVisibility,
} from '@/components/family/family-amount-visibility';
import { MOTION, isReducedMotion } from '@/lib/motion';

/**
 * 金额显隐切换时四类图表（趋势折线 / 桑基 / 结构环图 / 历史折线）的统一淡切容器。
 *
 * 状态变化：点击眼睛 → 金额显隐切换。
 * - 容器先淡出（small 档半程 90ms）→ 内部 Provider 的延迟值翻转，
 *   图表通过 G2 update 通道原地更新 labelFormatter / 节点文案（禁止 key 重挂载整图，
 *   不再重播入场动画）→ 再淡入（90ms），总计 small 档 180ms；
 * - 4 个图表共用同一时长与曲线，同屏节奏一致；
 * - reduced-motion 下跳过淡切，立即切换到终态。
 */
export function FamilyChartAmountFade({ children }: { children: ReactNode }) {
  const liveVisible = useFamilyAmountVisibility();
  const [chartVisible, setChartVisible] = useState(liveVisible);
  const [dipped, setDipped] = useState(false);

  useEffect(() => {
    if (liveVisible === chartVisible) {
      // 快速切回原状态：取消未完成的淡切，立即恢复显示
      setDipped(false);
      return;
    }
    if (isReducedMotion()) {
      setChartVisible(liveVisible);
      return;
    }
    setDipped(true);
    const swapTimer = window.setTimeout(() => {
      // 淡出到底后原地换内容，再淡入
      setChartVisible(liveVisible);
      setDipped(false);
    }, (MOTION.duration.small * 1000) / 2);
    return () => window.clearTimeout(swapTimer);
  }, [liveVisible, chartVisible]);

  return (
    <FamilyAmountVisibilityProvider value={chartVisible}>
      <div
        className="h-full w-full"
        style={{
          opacity: dipped ? 0 : 1,
          transitionProperty: 'opacity',
          transitionDuration: 'calc(var(--motion-duration-small) / 2)',
          transitionTimingFunction: 'var(--motion-ease-standard)',
        }}
      >
        {children}
      </div>
    </FamilyAmountVisibilityProvider>
  );
}
