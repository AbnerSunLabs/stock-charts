"use client";

import { HelpTooltip } from "@/components/shared/help-tooltip";
import { InputNumber } from "antd";

interface FundCoefficientConfigProps {
  amountPerGrid: number;
  onAmountPerGridChange: (value: number | null) => void;
  amountMultiplier: number;
  onAmountMultiplierChange: (value: number | null) => void;
  profitReserveMultiplier: number;
  onProfitReserveMultiplierChange: (value: number | null) => void;
}

/**
 * 资金系数：单格金额 + 加码/留利系数（已去掉总弹药与自动反推）。
 */
export function FundCoefficientConfig({
  amountPerGrid,
  onAmountPerGridChange,
  amountMultiplier,
  onAmountMultiplierChange,
  profitReserveMultiplier,
  onProfitReserveMultiplierChange,
}: FundCoefficientConfigProps) {
  return (
    <div className="space-y-4 p-4 sm:p-6 md:p-7">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="ds-section-title">资金系数</h3>
            <HelpTooltip
              size="md"
              placement="bottomLeft"
              maxWidth="16rem"
              title="按单格金额配置网格，支持越跌越买与留利底仓"
            />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <label
            htmlFor="amountPerGrid"
            className="flex items-center gap-1 text-xs font-semibold text-[var(--foreground)]"
          >
            <span className="text-[var(--loss)]">*</span>
            每份金额
          </label>
          <InputNumber
            id="amountPerGrid"
            value={amountPerGrid}
            onChange={onAmountPerGridChange}
            precision={0}
            min={100}
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

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label
              htmlFor="amountMultiplier"
              className="flex items-center gap-1 text-xs font-semibold text-[var(--foreground)]"
            >
              <span className="text-[var(--loss)]">*</span>
              金额加码系数
              <HelpTooltip
                title="控制越跌单档买入金额越大（资金维度）。与「动态间距」不同：动态间距只放大价格步长，不改变单档金额。"
                placement="topLeft"
                maxWidth="16rem"
              />
            </label>
            <InputNumber
              id="amountMultiplier"
              value={amountMultiplier}
              onChange={onAmountMultiplierChange}
              precision={1}
              min={0}
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

          <div className="space-y-2">
            <label
              htmlFor="profitReserveMultiplier"
              className="flex items-center gap-1 text-xs font-semibold text-[var(--foreground)]"
            >
              <span className="text-[var(--loss)]">*</span>
              保留利润系数
            </label>
            <InputNumber
              id="profitReserveMultiplier"
              value={profitReserveMultiplier}
              onChange={onProfitReserveMultiplierChange}
              precision={1}
              min={0}
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
        </div>
      </div>
    </div>
  );
}
