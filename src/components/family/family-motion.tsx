'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { MOTION, isReducedMotion } from '@/lib/motion';
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion';

/** G2 图表统一动画配置：入场 large（≤320ms）、更新 medium、退场比进场短。 */
export type FamilyChartAnimate =
  | false
  | {
      enter: { duration: number };
      update: { duration: number };
      exit: { duration: number };
    };

/**
 * G2 图表的统一动画档位（金额显隐 / 范围切换 / 数据更新共用）。
 * 状态变化：图表数据或文案更新 → 统一走显式 animate 配置，
 * 覆盖 G2 默认 ~450-500ms 的拖沓入场；reduced-motion 时整体 animate:false。
 * 用响应式 hook 读取偏好，用户在页面打开期间切换系统设置即时生效。
 */
export function useFamilyChartAnimate(): FamilyChartAnimate {
  const reduced = usePrefersReducedMotion();
  return useMemo(
    () =>
      reduced
        ? false
        : {
            enter: { duration: MOTION.duration.large * 1000 },
            update: { duration: MOTION.duration.medium * 1000 },
            exit: { duration: MOTION.exit.medium * 1000 },
          },
    [reduced]
  );
}

/**
 * 表格行删除的统一淡出收场（资产 / 负债 / 保单 / 成员表共用）。
 * 状态变化：删除确认成功 → 该行 opacity 淡出（exit-small 档）→ 再由调用方
 * 静默刷新数据，行从数据源消失。破坏性操作有收场交代，不凭空蒸发。
 * reduced-motion 下等待 0ms（瞬切）。
 */
export function useFamilyRowFadeRemoval(): {
  removingIds: ReadonlySet<string>;
  fadeOutRow: (id: string) => Promise<void>;
  /** 刷新结束后清算淡出标记：删除成功行已从数据消失（清空无害），
   *  刷新失败时旧数据仍在，行必须重新可见，避免「看不见但可点击」的幽灵行。 */
  settleRemovals: () => void;
} {
  const [removingIds, setRemovingIds] = useState<ReadonlySet<string>>(
    () => new Set()
  );

  const fadeOutRow = useCallback(async (id: string) => {
    setRemovingIds(prev => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    const ms = isReducedMotion() ? 0 : MOTION.exit.small * 1000;
    await new Promise<void>(resolve => {
      window.setTimeout(resolve, ms);
    });
  }, []);

  const settleRemovals = useCallback(() => {
    setRemovingIds(() => new Set());
  }, []);

  return { removingIds, fadeOutRow, settleRemovals };
}

/**
 * 弹窗内条件字段（类型切换 / 转移目标）的展开收起容器。
 * 状态变化：条件字段出现 / 消失 → grid-template-rows 0fr→1fr 过渡高度 +
 * 内容 small 档淡入，避免 Modal 高度跳变；只动 grid 行高与 opacity，
 * 不过渡 width/height/top/left。
 * 收起时 visibility 延迟到淡出结束再隐藏（从 tab 顺序与可访问性树移除）。
 */
export function FamilyFormDisclosure({
  visible,
  children,
}: {
  visible: boolean;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateRows: visible ? '1fr' : '0fr',
        opacity: visible ? 1 : 0,
        visibility: visible ? 'visible' : 'hidden',
        transitionProperty: 'grid-template-rows, opacity, visibility',
        transitionDuration:
          'var(--motion-duration-medium), var(--motion-duration-small), var(--motion-duration-medium)',
        transitionTimingFunction: 'var(--motion-ease-out), var(--motion-ease-out), linear',
        transitionDelay: visible
          ? '0s, 0s, 0s'
          : '0s, 0s, var(--motion-duration-medium)',
      }}
    >
      <div className="min-h-0 overflow-hidden">{children}</div>
    </div>
  );
}

/**
 * 元素是否进入视口（IntersectionObserver）。
 * 状态变化：滚动进出视口 → 持续型装饰动画（水波图波浪）只在视口内运行，
 * 离开视口即卸载图表停止重绘，控制多水波同屏的 CPU/GPU 占用。
 * 首帧乐观返回 true，避免初始加载闪空；观察启动后立即校正。
 */
export function useInViewport<T extends HTMLElement>(): [RefObject<T>, boolean] {
  const ref = useRef<T>(null);
  const [inViewport, setInViewport] = useState(true);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(entries => {
      const entry = entries[0];
      if (entry) setInViewport(entry.isIntersecting);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return [ref, inViewport];
}

/**
 * 家庭区动效共用样式（行删除淡出 + 筛选切换容器淡切），页面内渲染一次。
 * 选择器不加 .family-finance-page 前缀：保单独立路由没有该容器类，
 * 成员管理 Drawer 也会 portal 到 body；类名本身已是 family- 专用前缀，全局安全。
 * 只声明 opacity 相关属性，节奏全部引用 --motion-* token。
 */
export function FamilyMotionStyles() {
  return (
    <style>{`
.ant-table-tbody > tr.family-row-removing > td {
  opacity: 0;
  transition: opacity var(--motion-duration-exit-small) var(--motion-ease-in);
}
.family-table-swap-fade {
  animation: viewFadeIn var(--motion-duration-small) var(--motion-ease-out);
}
/* KPI 数值微闪（0.4→1）：收口在此，指标卡组件不再各自内联注入 */
@keyframes familyMetricValueIn {
  from { opacity: 0.4; }
  to { opacity: 1; }
}
    `}</style>
  );
}
