"use client";

import { QuestionCircleOutlined } from '@ant-design/icons';
import { Tooltip, type TooltipProps } from 'antd';
import type { ReactNode } from 'react';

type HelpTooltipSize = "sm" | "md";
type HelpTooltipVariant = "default" | "rich";

export const TOOLTIP_Z_INDEX = 99999;

interface HelpTooltipProps {
  title: ReactNode;
  size?: HelpTooltipSize;
  variant?: HelpTooltipVariant;
  placement?: TooltipProps["placement"];
  maxWidth?: number | string;
  className?: string;
}

interface DsTooltipProps {
  title: ReactNode;
  children: ReactNode;
  placement?: TooltipProps["placement"];
  maxWidth?: number | string;
  variant?: HelpTooltipVariant;
  /** 长备注需要折行；问号说明保持默认单段排版 */
  wrapBody?: boolean;
}

const SIZE_PX: Record<HelpTooltipSize, number> = {
  sm: 14,
  md: 16,
};

/**
 * 网格页白底深色字 Tooltip。
 * 主题 token `colorBgSpotlight` 与 `colorTextLightSolid` 均为白，裸用 antd Tooltip 会白字看不见。
 */
export function DsTooltip({
  title,
  children,
  placement = "top",
  maxWidth = "16rem",
  variant = "default",
  wrapBody = false,
}: DsTooltipProps) {
  const rootClassName =
    variant === "rich"
      ? "ds-help-tooltip ds-help-tooltip--rich"
      : "ds-help-tooltip";

  return (
    <Tooltip
      title={title}
      placement={placement}
      color="#ffffff"
      getPopupContainer={() =>
        (document.querySelector('.grid-shell') as HTMLElement) ?? document.body
      }
      classNames={{ root: rootClassName }}
      styles={{
        root: { zIndex: TOOLTIP_Z_INDEX },
        body: {
          maxWidth,
          backgroundColor: '#ffffff',
          color: 'var(--foreground)',
          ...(wrapBody
            ? { whiteSpace: 'pre-wrap' as const, wordBreak: 'break-word' as const }
            : {}),
        },
      }}
      zIndex={TOOLTIP_Z_INDEX}
    >
      {children}
    </Tooltip>
  );
}

export function HelpTooltip({
  title,
  size = "sm",
  variant = "default",
  placement = "top",
  maxWidth = "16rem",
  className = "",
}: HelpTooltipProps) {
  return (
    <DsTooltip
      title={title}
      placement={placement}
      maxWidth={maxWidth}
      variant={variant}
    >
      <span
        className="inline-flex shrink-0 cursor-help align-middle"
        tabIndex={0}
        aria-label="查看说明"
      >
        <QuestionCircleOutlined
          className={`text-[var(--muted-foreground)] opacity-60 transition-opacity hover:text-[var(--accent)] hover:opacity-100 ${className}`}
          style={{ fontSize: SIZE_PX[size] }}
        />
      </span>
    </DsTooltip>
  );
}
