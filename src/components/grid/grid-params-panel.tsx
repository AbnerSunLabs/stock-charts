'use client';

import { BaseInfoConfig } from '@/components/grid/base-info-config';
import { FundCoefficientConfig } from '@/components/grid/fund-coefficient-config';
import {
  GridStepConfig,
  GridStepFormulaHelp,
} from '@/components/grid/grid-step-config';
import { ChevronDown } from 'lucide-react';
import { useId, useState } from 'react';
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
  alignLastGridToStep: boolean;
  onAlignLastGridToStepChange: (enabled: boolean) => void;
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
  alignLastGridToStep,
  onAlignLastGridToStepChange,
  mode,
  onModeChange,
  stepDefaultOpen = false,
  embedded = false,
  footer,
}: GridParamsPanelProps) {
  /** 受控折叠态：替代原生 <details>，0fr→1fr 过渡 + Chevron 旋转 + 「展开/收起」文案切换 */
  const [stepOpen, setStepOpen] = useState(stepDefaultOpen);
  const stepContentId = useId();

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

      <div className={`grid-step-fold${stepOpen ? ' is-open' : ''}`}>
        <button
          type="button"
          className="grid-step-fold__summary"
          aria-expanded={stepOpen}
          aria-controls={stepContentId}
          onClick={() => setStepOpen(open => !open)}
        >
          <span>
            <span className="flex items-center gap-2">
              <span className="ds-section-title">步长与动态（进阶）</span>
              <span
                className="inline-flex"
                onClick={event => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
              >
                <GridStepFormulaHelp />
              </span>
            </span>
            <span className="grid-step-fold__sub mt-1 block">
              价格步长设置；动态间距只疏密档位，不改单档金额
            </span>
          </span>
          <span className="grid-step-fold__hint">
            {stepOpen ? '收起' : '展开'}
            <ChevronDown className="grid-step-fold__chevron" aria-hidden />
          </span>
        </button>
        <div className="grid-step-fold__content" id={stepContentId}>
          <div className="grid-step-fold__inner">
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
                alignLastGridToStep={alignLastGridToStep}
                onAlignLastGridToStepChange={onAlignLastGridToStepChange}
                mode={mode}
                onModeChange={onModeChange}
                compactHeader
              />
            </div>
          </div>
        </div>
      </div>

      {footer ? (
        <div className="border-t border-[var(--border)] bg-[color-mix(in_srgb,var(--surface-subtle)_55%,var(--card))] p-4 sm:p-6">
          {footer}
        </div>
      ) : null}
    </div>
  );
}
