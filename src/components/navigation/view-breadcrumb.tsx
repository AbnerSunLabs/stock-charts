'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Breadcrumb } from 'antd';
import type { ReactNode } from 'react';

const ROUTES: Record<string, string> = {
  '/view/sunburst': '资产旭日图',
  '/view/grid': '网格交易策略',
  '/view/index-levels': '点位跟踪',
  '/view/family': '家庭财务总览',
  '/view/family/ledger': '资产记账',
  '/view/family/policies': '保单管理',
};

/**
 * 分析视图的面包屑导航，展示从首页到当前视图的路径。
 */
export function ViewBreadcrumb() {
  const pathname = usePathname();

  const items: Array<{ title: ReactNode }> = [{ title: <Link href="/">长流</Link> }];

  if (pathname?.startsWith('/view/family')) {
    items.push({ title: <Link href="/view/family">家庭财务总览</Link> });
    if (pathname === '/view/family/ledger') {
      items.push({ title: '资产记账' });
    } else if (pathname === '/view/family/policies') {
      items.push({ title: '保单管理' });
    }
  } else if (pathname && pathname !== '/') {
    items.push({ title: ROUTES[pathname] ?? '详情' });
  }

  return (
    /* 状态变化：悬停面包屑链接时文字颜色切到强调色——color 过渡走 micro token，与全站 hover 节奏一致 */
    <nav
      className="mb-4 pr-12 sm:pr-0 [&_.ant-breadcrumb-link]:text-[var(--text-muted)] [&_.ant-breadcrumb-link:hover]:text-[var(--text-accent)] [&_.ant-breadcrumb-link]:[transition:color_var(--motion-duration-micro)_var(--motion-ease-out)] [&_.ant-breadcrumb-separator]:text-[var(--text-muted)] [&_.ant-breadcrumb-separator]:opacity-60"
      aria-label="面包屑"
    >
      <Breadcrumb items={items} />
    </nav>
  );
}
