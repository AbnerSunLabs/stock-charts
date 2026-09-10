"use client";

import { HelpTooltip } from "@/components/shared/help-tooltip";
import { InputNumber } from "antd";
import { useMemo } from "react";

interface BaseInfoConfigProps {
  minTradeUnit: number;
  onMinTradeUnitChange: (value: number | null) => void;
  priceUnit: number;
  onPriceUnitChange: (value: number | null) => void;
  basePrice: number;
  onBasePriceChange: (value: number | null) => void;
  minPrice: number;
  onMinPriceChange: (value: number | null) => void;
}

export function BaseInfoConfig({
  minTradeUnit,
  onMinTradeUnitChange,
  priceUnit,
  onPriceUnitChange,
  basePrice,
  onBasePriceChange,
  minPrice,
  onMinPriceChange,
}: BaseInfoConfigProps) {
  // 计算价格精度对应的小数位数
  const priceDecimals = useMemo(() => {
    if (priceUnit >= 1) return 0;
    if (priceUnit >= 0.1) return 1;
    if (priceUnit >= 0.01) return 2;
    if (priceUnit >= 0.001) return 3;
    return 4;
  }, [priceUnit]);

  const fields: Array<{
    key: string;
    label: string;
    value: number;
    onChange: (value: number | null) => void;
    tooltip: string;
    precision: number;
    min: number;
  }> = [
    {
      key: "minTradeUnit",
      label: "最小交易单位",
      value: minTradeUnit,
      onChange: onMinTradeUnitChange,
      tooltip: "单次交易的最小股数",
      precision: 0,
      min: 1,
    },
    {
      key: "priceUnit",
      label: "价格精度",
      value: priceUnit,
      onChange: onPriceUnitChange,
      tooltip: "价格精度，如 0.001 表示保留3位小数",
      precision: 4,
      min: 0.0001,
    },
    {
      key: "basePrice",
      label: "基准价",
      value: basePrice,
      onChange: onBasePriceChange,
      tooltip: "网格交易的起始价格",
      precision: priceDecimals,
      min: 0.0001,
    },
    {
      key: "minPrice",
      label: "最低价",
      value: minPrice,
      onChange: onMinPriceChange,
      tooltip: "计划接到什么价位。最后一档要不要改写成这个价，看步长区的「对齐步长」。",
      precision: priceDecimals,
      min: 0.0001,
    },
  ];

  return (
    <div className="space-y-4 p-4 sm:p-6 md:p-7">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="ds-section-title">基准信息</h3>
            <HelpTooltip
              size="md"
              placement="bottomLeft"
              maxWidth="16rem"
              title="设置网格交易的基础参数，包括交易单位、价格精度和价格区间"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {fields.map((field) => (
          <div key={field.key} className="space-y-2">
            <label
              htmlFor={field.key}
              className="flex items-center gap-1 text-xs font-semibold text-[var(--foreground)]"
            >
              <span className="text-[var(--loss)]">*</span>
              {field.label}
              <HelpTooltip title={field.tooltip} placement="topLeft" />
            </label>
            <InputNumber
              id={field.key}
              value={field.value}
              onChange={(value) => field.onChange(value)}
              precision={field.precision}
              min={field.min}
              controls={false}
              className="w-full"
              style={{
                width: "100%",
                textAlign: "center",
                fontWeight: 600,
                fontSize: "16px",
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
