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

const SIZE_PX: Record<HelpTooltipSize, number> = {
  sm: 14,
  md: 16,
};

export function HelpTooltip({
  title,
  size = "sm",
  variant = "default",
  placement = "top",
  maxWidth = "16rem",
  className = "",
}: HelpTooltipProps) {
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
        },
      }}
      zIndex={TOOLTIP_Z_INDEX}
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
    </Tooltip>
  );
}
