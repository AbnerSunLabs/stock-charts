'use client';

import {
  LineChartOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  PieChartOutlined,
  TableOutlined,
} from '@ant-design/icons';
import { Tooltip } from 'antd';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';

import { ChangliuMark } from '@/components/brand/changliu-mark';
import {
  RESEARCH_TOOLS,
  resolveResearchMenuKey,
} from '@/components/research/research-catalog';

import './research-shell.css';

const TOOL_ICONS: Record<string, ReactNode> = {
  '/view/sunburst': <PieChartOutlined />,
  '/view/grid': <TableOutlined />,
  '/view/index-levels': <LineChartOutlined />,
};

interface RailItem {
  href: string;
  label: string;
}

const RAIL_ITEMS: RailItem[] = RESEARCH_TOOLS.map((tool) => ({
  href: tool.href,
  label: tool.label,
}));

/** 一条菜单。扩展态带文字，收缩态只留图标，名称改由提示出现。 */
function RailLink({ item, active, collapsed }: { item: RailItem; active: boolean; collapsed: boolean }) {
  const className = active ? 'research-rail-item is-active' : 'research-rail-item';
  const link = (
    <Link href={item.href} className={className} aria-label={item.label} aria-current={active ? 'page' : undefined}>
      <span className="research-rail-icon">{TOOL_ICONS[item.href]}</span>
      <span className="research-rail-label">{item.label}</span>
    </Link>
  );
  if (!collapsed) return link;
  return (
    <Tooltip title={item.label} placement="right">
      {link}
    </Tooltip>
  );
}

/**
 * 左侧菜单。扩展态为图标加文字，收缩态只留图标。
 */
function ResearchRail({ pathname, collapsed }: { pathname: string; collapsed: boolean }) {
  const current = resolveResearchMenuKey(pathname);
  const railClass = collapsed ? 'research-rail is-collapsed' : 'research-rail';

  return (
    <aside className={railClass}>
      <Link className="research-rail-home" href="/" aria-label="长流首页">
        <ChangliuMark />
        <span className="research-brand-name">长流</span>
      </Link>
      <nav aria-label="投研工具">
        {RAIL_ITEMS.map((item) => (
          <RailLink key={item.href} item={item} active={item.href === current} collapsed={collapsed} />
        ))}
      </nav>
    </aside>
  );
}

/**
 * 投研工具壳：左侧菜单，右侧内容。内容区顶栏按钮在扩展与收缩之间切换。
 */
export function ResearchShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? '';
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="research-shell">
      <ResearchRail pathname={pathname} collapsed={collapsed} />
      <div className="research-stage">
        <div className="research-head">
          <button
            type="button"
            className="research-rail-toggle"
            aria-label={collapsed ? '展开菜单' : '收起菜单'}
            aria-expanded={!collapsed}
            onClick={() => setCollapsed((open) => !open)}
          >
            {/* key 随折叠态切换重挂载，触发一次换向淡入 */}
            <span key={collapsed ? 'unfold' : 'fold'} className="research-rail-toggle__icon">
              {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            </span>
          </button>
        </div>
        <div className="research-content">{children}</div>
      </div>
    </div>
  );
}
