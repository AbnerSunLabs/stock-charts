"use client";

import { AlertCircle } from "lucide-react";

interface ErrorAlertProps {
  errors: string[];
  title?: string;
}

/**
 * 参数校验/生成失败告警块：进场 0fr→1fr 展开加淡入（.grid-reveal），
 * 解释「校验结果插入」这一状态变化；离场随条件渲染瞬切。
 */
export function ErrorAlert({ errors, title = '参数校验未通过' }: ErrorAlertProps) {
  if (errors.length === 0) return null;

  return (
    <div className="grid-reveal mb-8">
      <div className="grid-reveal__inner">
        <div
          className="rounded-xl border border-[color-mix(in_srgb,var(--loss)_35%,var(--border))] bg-[color-mix(in_srgb,var(--loss)_6%,var(--card))] p-5 shadow-[var(--ds-shadow-sm)] backdrop-blur-sm"
          role="alert"
        >
          <div className="mb-3 flex items-center gap-2">
            <AlertCircle className="h-5 w-5 shrink-0 text-[var(--loss)]" />
            <span className="font-semibold text-[var(--foreground)]">
              {title}
            </span>
          </div>
          <ul className="list-inside list-disc space-y-1.5 text-sm leading-relaxed text-[color-mix(in_srgb,var(--foreground)_88%,var(--loss))] marker:text-[var(--loss)]">
            {errors.map((error, i) => (
              <li key={i}>{error}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
