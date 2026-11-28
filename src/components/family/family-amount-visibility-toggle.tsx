'use client';

import type { ReactNode } from 'react';
import { EyeFilled, EyeInvisibleFilled } from '@ant-design/icons';
import { useFamilyAmountVisibility } from '@/components/family/family-amount-visibility';

/** 单个图标层：绝对定位铺满按钮图标位，仅过渡 opacity/transform（micro 档）。 */
function IconLayer({ shown, children }: { shown: boolean; children: ReactNode }) {
  return (
    <span
      className="absolute inset-0 flex items-center justify-center"
      style={{
        opacity: shown ? 1 : 0,
        transform: `scale(${shown ? 1 : 0.85})`,
        transitionProperty: 'opacity, transform',
        transitionDuration: 'var(--motion-duration-micro)',
        transitionTimingFunction: 'var(--motion-ease-out)',
      }}
    >
      {children}
    </span>
  );
}

/**
 * 金额显隐切换按钮（总览 / 记账页共用）。
 *
 * 状态变化：点击眼睛切换金额显隐。
 * 图标改为双层叠放 crossfade + scale(0.85→1) micro 档切换，
 * 两态不重挂载、按钮尺寸不跳；hover / 按压反馈由全局
 * .family-amount-visibility-toggle 样式负责（token 化的 micro 过渡）。
 */
export function FamilyAmountVisibilityButton({
  onToggle,
}: {
  onToggle: () => void;
}) {
  const visible = useFamilyAmountVisibility();

  return (
    <button
      type="button"
      className="family-amount-visibility-toggle"
      aria-label={visible ? '隐藏金额' : '显示金额'}
      aria-pressed={visible}
      onClick={onToggle}
    >
      <span
        className="relative inline-flex h-[1em] w-[1em] items-center justify-center"
        aria-hidden
      >
        <IconLayer shown={visible}>
          <EyeFilled />
        </IconLayer>
        <IconLayer shown={!visible}>
          <EyeInvisibleFilled />
        </IconLayer>
      </span>
    </button>
  );
}
