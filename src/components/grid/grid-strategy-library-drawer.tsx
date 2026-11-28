'use client';

import { Button, Drawer, Dropdown, Empty } from 'antd';
import {
  ClockCircleOutlined,
  MoreOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';
import type { GridStrategyMetadata } from '@/types/grid-strategy-storage';
import { MOTION, isReducedMotion } from '@/lib/motion';
import { useGSAP } from '@gsap/react';
import { gsap } from 'gsap';
import { useEffect, useRef, type ReactNode } from 'react';


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
          {/* 骨架底色与扫光统一走全局 .motion-skeleton */}
          <div className="motion-skeleton grid-strategy-library__skeleton-mark" />
          <div className="grid-strategy-library__skeleton-copy">
            <div className="motion-skeleton grid-strategy-library__skeleton-line grid-strategy-library__skeleton-line--title" />
            <div className="motion-skeleton grid-strategy-library__skeleton-line grid-strategy-library__skeleton-line--meta" />
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
  /** 记录上一帧 open：入场 stagger 只沿 open 的 false→true 沿触发，数据刷新不重播 */
  const prevOpenRef = useRef(false);

  useGSAP(
    () => {
      if (!open) {
        // 关闭：重置入场机会，下次打开重新沿触发
        prevOpenRef.current = false;
        return;
      }
      // 打开但列表未就绪（loading/error/空）：不消耗入场机会，等列表真实挂载那一帧
      if (loading || error || strategies.length === 0) return;
      const firstOpen = !prevOpenRef.current;
      prevOpenRef.current = true;
      // 打开期间的后续数据刷新（改名/删除/打开策略后重拉）不重播整列
      if (!firstOpen) return;
      if (!listRef.current || isReducedMotion()) return;
      const items = listRef.current.querySelectorAll(
        '.grid-strategy-library__item'
      );
      gsap.fromTo(
        items,
        { autoAlpha: 0, y: 10 },
        {
          autoAlpha: 1,
          y: 0,
          duration: MOTION.duration.medium,
          stagger: {
            each: MOTION.stagger.item,
            amount: MOTION.stagger.maxTotal,
          },
          ease: MOTION.ease.out,
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
