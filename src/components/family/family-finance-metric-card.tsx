'use client';

import { Card } from 'antd';
import { FamilyAmountText } from '@/components/family/family-amount-text';

export type FamilyFinanceMetricTone = 'primary' | 'neutral' | 'positive' | 'negative';

interface FamilyFinanceMetricCardProps {
  label: string;
  value: number;
  tone: FamilyFinanceMetricTone;
  loading: boolean;
  hint: string;
  /** 首屏 KPI 卡 stagger 序号（0 起，卡片间隔 --motion-stagger-card，仅首屏入场播放） */
  stagger?: number;
}

/**
 * KPI 指标卡（总资产 / 总负债 / 净资产）。
 *
 * 状态变化与动效：
 * - 骨架 → 内容：antd Card loading 期间 children 不挂载，loading 结束时内容以
 *   small 档淡入覆盖（viewFadeIn），内容区 min-height 防止与骨架高度差导致的弹跳；
 * - 数值更新（静默刷新后新值到达）：旧值保持到新值到达，新值 opacity 0.4→1 微闪
 *   （small 档），不做滚动计数器（金融数据忌误导读数）；
 * - tone 变化（如净资产转负）：数值颜色 small 档 color 过渡；
 * - 首屏入场：卡片本体走 motion-enter--card（cardFadeIn，large 档）+ 卡片 stagger。
 */
export function FamilyFinanceMetricCard({
  label,
  value,
  tone,
  loading,
  hint,
  stagger = 0,
}: FamilyFinanceMetricCardProps) {
  return (
    <Card
      loading={loading}
      className={`family-finance-metric family-finance-metric--${tone} motion-enter--card`}
      style={{
        animationDelay: `calc(var(--motion-stagger-card) * ${stagger})`,
      }}
    >
      {/* 数值微闪关键帧 familyMetricValueIn 收口在 FamilyMotionStyles（页面渲染一次），组件不再内联注入 */}
      <div
        className="family-finance-metric__content min-h-[124px]"
        style={{
          animationName: 'viewFadeIn',
          animationDuration: 'var(--motion-duration-small)',
          animationTimingFunction: 'var(--motion-ease-out)',
        }}
      >
        <div className="family-finance-metric__label">
          <span className="family-finance-metric__marker" aria-hidden />
          {label}
        </div>
        <div
          className="family-finance-metric__value family-finance-monetary-value"
          style={{
            transitionProperty: 'color',
            transitionDuration: 'var(--motion-duration-small)',
            transitionTimingFunction: 'var(--motion-ease-out)',
          }}
        >
          {/* key=value：数值变化时重放一次 0.4→1 微闪；显隐切换由 FamilyAmountText 自行淡切 */}
          <span
            key={value}
            className="inline-block"
            style={{
              animationName: 'familyMetricValueIn',
              animationDuration: 'var(--motion-duration-small)',
              animationTimingFunction: 'var(--motion-ease-out)',
            }}
          >
            <FamilyAmountText amount={value} />
          </span>
        </div>
        <div className="family-finance-metric__hint">{hint}</div>
      </div>
    </Card>
  );
}
