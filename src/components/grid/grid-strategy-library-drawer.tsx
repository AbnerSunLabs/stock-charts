'use client';

import { Button, Drawer, Dropdown, Empty } from 'antd';
import {
  ClockCircleOutlined,
  MoreOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';
import type { GridStrategyMetadata } from '@/types/grid-strategy-storage';
import { useGSAP } from '@gsap/react';
import { gsap } from 'gsap';
import { useRef, type ReactNode } from 'react';

gsap.registerPlugin(useGSAP);

export interface GridStrategyLibraryDrawerProps {
  open: boolean;
  strategies: GridStrategyMetadata[];
  currentStrategyId: string | null;
  loading: boolean;
  error: string | null;
  actionId: string | null;
  isMobile: boolean;
  onClose: () => void;
  onRetry: () => void;
  onOpenStrategy: (id: string) => void;
  onRenameStrategy: (strategy: GridStrategyMetadata) => void;
  onDeleteStrategy: (strategy: GridStrategyMetadata) => void;
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** 取策略名首字作为视觉锚点 */
function strategyInitial(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '策';
  return Array.from(trimmed)[0] ?? '策';
}

function formatAbsoluteTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * 相对更新时间，便于列表扫读。
 */
function formatRelativeUpdatedAt(iso: string, now = Date.now()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const diffMs = now - date.getTime();
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diffMs < minute) return '刚刚更新';
  if (diffMs < hour) return `${Math.floor(diffMs / minute)} 分钟前更新`;
  if (diffMs < day) return `${Math.floor(diffMs / hour)} 小时前更新`;
  if (diffMs < 7 * day) return `${Math.floor(diffMs / day)} 天前更新`;

  return `更新于 ${formatAbsoluteTime(iso)}`;
}

function LibrarySkeleton() {
  return (
    <ul className="grid-strategy-library__list" aria-hidden>
      {[0, 1, 2].map(index => (
        <li key={index} className="grid-strategy-library__skeleton-item">
          <div className="grid-strategy-library__skeleton-mark" />
          <div className="grid-strategy-library__skeleton-copy">
            <div className="grid-strategy-library__skeleton-line grid-strategy-library__skeleton-line--title" />
            <div className="grid-strategy-library__skeleton-line grid-strategy-library__skeleton-line--meta" />
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * “我的策略”列表抽屉：保留 Drawer 壳，列表与动效重做。
 */
export function GridStrategyLibraryDrawer({
  open,
  strategies,
  currentStrategyId,
  loading,
  error,
  actionId,
  isMobile,
  onClose,
  onRetry,
  onOpenStrategy,
  onRenameStrategy,
  onDeleteStrategy,
}: GridStrategyLibraryDrawerProps) {
  const listRef = useRef<HTMLUListElement>(null);

  useGSAP(
    () => {
      if (!open || loading || error || strategies.length === 0) return;
      if (!listRef.current || prefersReducedMotion()) return;
      const items = listRef.current.querySelectorAll(
        '.grid-strategy-library__item'
      );
      gsap.fromTo(
        items,
        { autoAlpha: 0, y: 12 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.3,
          stagger: 0.055,
          ease: 'power2.out',
          overwrite: true,
        }
      );
    },
    {
      scope: listRef,
      dependencies: [open, loading, error, strategies],
    }
  );

  let body: ReactNode;
  if (loading) {
    body = <LibrarySkeleton />;
  } else if (error) {
    body = (
      <div className="grid-strategy-library__center">
        <p className="grid-strategy-library__error">{error}</p>
        <Button icon={<ReloadOutlined />} onClick={onRetry} shape="round">
          重试
        </Button>
      </div>
    );
  } else if (strategies.length === 0) {
    body = (
      <div className="grid-strategy-library__empty">
        <Empty description="还没有保存的策略" />
        <p className="grid-strategy-library__empty-hint">
          生成策略后，点击「保存策略」即可收入此处
        </p>
      </div>
    );
  } else {
    body = (
      <div className="grid-strategy-library__body">
        <p className="grid-strategy-library__count">
          共 {strategies.length} 条已保存策略
        </p>
        <ul ref={listRef} className="grid-strategy-library__list">
          {strategies.map(strategy => {
            const busy = actionId === strategy.id;
            const isCurrent = currentStrategyId === strategy.id;
            const menuItems: MenuProps['items'] = [
              {
                key: 'rename',
                label: '改名',
                disabled: busy,
                onClick: () => onRenameStrategy(strategy),
              },
              {
                key: 'delete',
                label: '删除',
                danger: true,
                disabled: busy,
                onClick: () => onDeleteStrategy(strategy),
              },
            ];

            return (
              <li
                key={strategy.id}
                className={`grid-strategy-library__item${
                  isCurrent ? ' grid-strategy-library__item--current' : ''
                }`}
              >
                <div
                  className={`grid-strategy-library__mark${
                    isCurrent
                      ? ' grid-strategy-library__mark--current'
                      : ''
                  }`}
                  aria-hidden
                >
                  {strategyInitial(strategy.name)}
                </div>
                <div className="grid-strategy-library__main">
                  <div className="grid-strategy-library__title-row">
                    <span className="grid-strategy-library__name">
                      {strategy.name}
                    </span>
                    {isCurrent ? (
                      <span className="grid-strategy-library__badge">
                        当前打开
                      </span>
                    ) : null}
                  </div>
                  <span
                    className="grid-strategy-library__time"
                    title={formatAbsoluteTime(strategy.updatedAt)}
                  >
                    <ClockCircleOutlined
                      className="grid-strategy-library__time-icon"
                      aria-hidden
                    />
                    {formatRelativeUpdatedAt(strategy.updatedAt)}
                  </span>
                </div>
                <div className="grid-strategy-library__actions">
                  <Button
                    type="primary"
                    shape="round"
                    size="small"
                    className="grid-strategy-library__open"
                    loading={busy}
                    disabled={Boolean(actionId) && !busy}
                    onClick={() => onOpenStrategy(strategy.id)}
                  >
                    打开
                  </Button>
                  <Dropdown menu={{ items: menuItems }} trigger={['click']}>
                    <Button
                      type="text"
                      className="grid-strategy-library__more"
                      icon={<MoreOutlined />}
                      aria-label={`更多操作：${strategy.name}`}
                      disabled={Boolean(actionId)}
                    />
                  </Dropdown>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  return (
    <Drawer
      title="我的策略"
      open={open}
      onClose={onClose}
      placement={isMobile ? 'bottom' : 'right'}
      width={isMobile ? undefined : 420}
      height={isMobile ? '90%' : undefined}
      destroyOnHidden={false}
      getContainer={() =>
        document.querySelector('.grid-shell') ?? document.body
      }
      rootClassName="grid-strategy-library-drawer"
    >
      {body}
    </Drawer>
  );
}
