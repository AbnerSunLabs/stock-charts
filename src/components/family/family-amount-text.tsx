'use client';

import { useFamilyAmountVisibility } from '@/components/family/family-amount-visibility';
import { formatCny, MASKED_AMOUNT } from '@/lib/family-finance/format';

/**
 * 统一的文本金额展示（表格金额列 / KPI 大数字 / 图例金额等）。
 *
 * 状态变化：金额显隐切换（点击眼睛）。
 * - 掩码层做 blur(6px)+opacity 的 small 档淡切，避免字符串硬跳；
 * - 底层常挂一份不可见的真实金额撑住宽度（同宽掩码），**** 与真实金额互换
 *   不会引起表格列宽 / KPI 卡片抖动（CLS≈0）；
 * - 展示层 absolute inset-0，对齐方式继承容器 text-align，掩码与真实金额同位。
 * - reduced-motion 下时长 token 归零，瞬切到终态。
 */
export function FamilyAmountText({
  amount,
  className,
}: {
  amount: number;
  className?: string;
}) {
  const visible = useFamilyAmountVisibility();
  const realText = formatCny(amount);

  return (
    <span
      className={`relative inline-block whitespace-nowrap tabular-nums ${className ?? ''}`}
    >
      {/* 宽度占位层：真实金额不可见但参与布局 */}
      <span aria-hidden className="invisible">
        {realText}
      </span>
      {/* 展示层：随显隐状态淡切 */}
      <span
        className="absolute inset-0"
        style={{
          opacity: visible ? 1 : 0.72,
          filter: visible ? 'blur(0px)' : 'blur(6px)',
          transitionProperty: 'opacity, filter',
          transitionDuration: 'var(--motion-duration-small)',
          transitionTimingFunction: 'var(--motion-ease-out)',
        }}
      >
        {visible ? realText : MASKED_AMOUNT}
      </span>
    </span>
  );
}
