'use client';

import { BaseInfoConfig } from '@/components/grid/base-info-config';
import { FundCoefficientConfig } from '@/components/grid/fund-coefficient-config';
import { GridStepConfig } from '@/components/grid/grid-step-config';
import type { ReactNode } from 'react';

export interface GridParamsPanelProps {
  minTradeUnit: number;
  onMinTradeUnitChange: (value: number | null) => void;
  priceUnit: number;
  onPriceUnitChange: (value: number | null) => void;
  basePrice: number;
  onBasePriceChange: (value: number | null) => void;
  minPrice: number;
  onMinPriceChange: (value: number | null) => void;
  amountPerGrid: number;
  onAmountPerGridChange: (value: number | null) => void;
  amountMultiplier: number;
  onAmountMultiplierChange: (value: number | null) => void;
  profitReserveMultiplier: number;
  onProfitReserveMultiplierChange: (value: number | null) => void;
  baseStep: number;
  onBaseStepChange: (value: number) => void;
  mediumStep: number;
  onMediumStepChange: (value: number) => void;
  largeStep: number;
  onLargeStepChange: (value: number) => void;
  dynamicEnabled: boolean;
  onDynamicEnabledChange: (enabled: boolean) => void;
  mode: 'stable' | 'aggressive';
  onModeChange: (mode: 'stable' | 'aggressive') => void;
  /** 步长段是否默认展开（默认收起） */
  stepDefaultOpen?: boolean;
  /** Drawer 内嵌时去掉外层卡片边框，避免双层盒子 */
  embedded?: boolean;
  footer?: ReactNode;
}

/**
 * 网格参数面板：价格边界 / 资金系数 / 可折叠步长 + 底部 CTA。
 */
export function GridParamsPanel({
  minTradeUnit,
  onMinTradeUnitChange,
  priceUnit,
  onPriceUnitChange,
  basePrice,
  onBasePriceChange,
  minPrice,
  onMinPriceChange,
  amountPerGrid,
  onAmountPerGridChange,
  amountMultiplier,
  onAmountMultiplierChange,
  profitReserveMultiplier,
  onProfitReserveMultiplierChange,
  baseStep,
  onBaseStepChange,
  mediumStep,
  onMediumStepChange,
  largeStep,
  onLargeStepChange,
  dynamicEnabled,
  onDynamicEnabledChange,
  mode,
  onModeChange,
  stepDefaultOpen = false,
  embedded = false,
  footer,
}: GridParamsPanelProps) {
  return (
    <div className={embedded ? 'grid-params-panel--embedded' : 'grid-card'}>
      <div className="border-b border-[var(--border)]">
        <BaseInfoConfig
          minTradeUnit={minTradeUnit}
          onMinTradeUnitChange={onMinTradeUnitChange}
          priceUnit={priceUnit}
          onPriceUnitChange={onPriceUnitChange}
          basePrice={basePrice}
          onBasePriceChange={onBasePriceChange}
          minPrice={minPrice}
          onMinPriceChange={onMinPriceChange}
        />
      </div>

      <div className="border-b border-[var(--border)]">
        <FundCoefficientConfig
          amountPerGrid={amountPerGrid}
          onAmountPerGridChange={onAmountPerGridChange}
          amountMultiplier={amountMultiplier}
          onAmountMultiplierChange={onAmountMultiplierChange}
          profitReserveMultiplier={profitReserveMultiplier}
          onProfitReserveMultiplierChange={onProfitReserveMultiplierChange}
        />
      </div>

      <details className="grid-step-details" open={stepDefaultOpen || undefined}>
        <summary className="grid-step-details__summary">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="ds-section-title">步长与动态（进阶）</h3>
            </div>
            <p className="grid-step-details__hint mt-1">
              价格步长设置；动态间距只疏密档位，不改单档金额
            </p>
          </div>
          <span className="grid-step-details__hint" aria-hidden>
            展开
          </span>
        </summary>
        <div className="border-b border-[var(--border)]">
          <GridStepConfig
            baseStep={baseStep}
            onBaseStepChange={onBaseStepChange}
            mediumStep={mediumStep}
            onMediumStepChange={onMediumStepChange}
            largeStep={largeStep}
            onLargeStepChange={onLargeStepChange}
            dynamicEnabled={dynamicEnabled}
            onDynamicEnabledChange={onDynamicEnabledChange}
            mode={mode}
            onModeChange={onModeChange}
            compactHeader
          />
        </div>
      </details>

      {footer ? (
        <div className="border-t border-[var(--border)] bg-[color-mix(in_srgb,var(--surface-subtle)_55%,var(--card))] p-4 sm:p-6">
          {footer}
        </div>
      ) : null}
    </div>
  );
}
