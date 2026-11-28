'use client';

import dynamic from 'next/dynamic';
import { useMemo } from 'react';
import { Empty } from 'antd';
import type { FamilyLedgerItem, FamilyMember } from '@/types/family-finance';
import {
  buildFamilyAssetSankeyLinks,
  hasSankeyLiabilityHub,
  isSankeyHubNode,
  SANK_LIABILITY_HUB_PREFIX,
  SANK_TOTAL_HUB_PREFIX,
  type FamilyAssetSankeyLink,
} from '@/lib/family-finance/asset-sankey';
import { formatCny } from '@/lib/family-finance/format';
import { useFamilyAmountVisibility } from '@/components/family/family-amount-visibility';
import { useFamilyChartAnimate } from '@/components/family/family-motion';

const Sankey = dynamic(() => import('@ant-design/charts').then(mod => mod.Sankey), {
  ssr: false,
  /* 状态变化：图表库异步加载占位——骨架扫光统一走 motion-skeleton（--bg-muted 未定义会呈透明洞） */
  loading: () => <div className="motion-skeleton h-[360px] rounded-lg" />,
});

/** 负债 / 总资产柱额外描边加宽。 */
const HUB_EXTRA_WIDTH = 18;
const DEFAULT_NODE_WIDTH = 0.018;

/**
 * 对齐有知有行参考图色板：
 * 负债灰、净资产薄荷绿、总资产紫灰；四笔钱 / 明细为柔和纯色。
 */
const SANK_COLORS = {
  liability: '#5f5f6e',
  netWorth: '#36d0b8',
  total: '#9b91c4',
  liquid: '#6a9aaa',
  stable: '#9585c9',
  longTerm: '#a898d0',
  insurance: '#b0b0bc',
  leaf: ['#6a9aaa', '#e8a07a', '#a896d4', '#b8a890', '#9a9aac', '#7aafc0', '#c9a0d0'],
} as const;

interface FamilyAssetSankeyProps {
  items: FamilyLedgerItem[];
  members: FamilyMember[];
  height?: number;
}

function HubBadge({ children }: { children: string }) {
  return (
    <span className="inline-flex items-center rounded-md border border-slate-200 bg-white px-2.5 py-0.5 text-xs font-medium text-slate-600 shadow-sm">
      {children}
    </span>
  );
}

function hashKey(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i += 1) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return h;
}

function buildNodeColorResolver(links: FamilyAssetSankeyLink[]): (key: string) => string {
  const liabilityItems = new Set(
    links.filter(l => l.target.startsWith(`${SANK_LIABILITY_HUB_PREFIX} ·`)).map(l => l.source)
  );
  const assetItems = new Set(
    links
      .filter(
        l =>
          l.source.startsWith('活钱 ·') ||
          l.source.startsWith('稳钱 ·') ||
          l.source.startsWith('长钱 ·') ||
          l.source.startsWith('保险 ·')
      )
      .map(l => l.target)
  );

  return (key: string): string => {
    if (key.startsWith(`${SANK_LIABILITY_HUB_PREFIX} ·`)) return SANK_COLORS.liability;
    if (key.startsWith(`${SANK_TOTAL_HUB_PREFIX} ·`)) return SANK_COLORS.total;
    if (key.startsWith('净资产 ·')) return SANK_COLORS.netWorth;
    if (key.startsWith('活钱 ·')) return SANK_COLORS.liquid;
    if (key.startsWith('稳钱 ·')) return SANK_COLORS.stable;
    if (key.startsWith('长钱 ·')) return SANK_COLORS.longTerm;
    if (key.startsWith('保险 ·')) return SANK_COLORS.insurance;
    if (liabilityItems.has(key)) return SANK_COLORS.liability;
    if (assetItems.has(key)) {
      return SANK_COLORS.leaf[hashKey(key) % SANK_COLORS.leaf.length];
    }
    return SANK_COLORS.total;
  };
}

/**
 * 家庭资产结构桑基图：负债/净资产 → 总资产 → 四笔钱 → 条目。
 * 配色对齐参考图；汇总柱纯色加宽；连线透明度 0.6。
 *
 * 金额显隐切换：使用方用 FamilyChartAmountFade 包裹本组件，节点文案（含金额）的
 * 更新被延迟到容器淡出到底后走 G2 update 通道原地重排，不再 key 重挂载整图。
 */
export function FamilyAssetSankey({ items, members, height = 420 }: FamilyAssetSankeyProps) {
  const amountsVisible = useFamilyAmountVisibility();
  const chartAnimate = useFamilyChartAnimate();
  const data = useMemo(
    () => buildFamilyAssetSankeyLinks(items, members, { amountsVisible }),
    [items, members, amountsVisible]
  );
  const resolveColor = useMemo(() => buildNodeColorResolver(data), [data]);

  if (data.length === 0) {
    return <Empty description="暂无已标注四笔钱的资产，无法绘制桑基图" />;
  }

  const showLiabilityHub = hasSankeyLiabilityHub(data);
  const columnCount = showLiabilityHub ? 5 : 4;
  const liabilityCol = showLiabilityHub ? 1 : -1;
  const totalCol = showLiabilityHub ? 2 : 1;

  return (
    <div className="relative">
      <div
        className="pointer-events-none absolute left-0 right-0 top-0 z-10 flex px-4"
        aria-hidden
      >
        {Array.from({ length: columnCount }, (_, col) => (
          <div key={col} className="flex flex-1 justify-center pt-1">
            {col === liabilityCol ? <HubBadge>{SANK_LIABILITY_HUB_PREFIX}</HubBadge> : null}
            {col === totalCol ? <HubBadge>{SANK_TOTAL_HUB_PREFIX}</HubBadge> : null}
          </div>
        ))}
      </div>

      <Sankey
        data={data}
        height={height}
        animate={chartAnimate}
        marginLeft={16}
        marginRight={16}
        marginTop={36}
        marginBottom={8}
        layout={{
          nodeAlign: 'justify',
          nodePadding: 0.04,
          nodeWidth: DEFAULT_NODE_WIDTH,
        }}
        scale={{
          color: {
            range: [
              SANK_COLORS.liability,
              SANK_COLORS.netWorth,
              SANK_COLORS.total,
              SANK_COLORS.liquid,
              SANK_COLORS.stable,
              SANK_COLORS.longTerm,
              SANK_COLORS.insurance,
              ...SANK_COLORS.leaf,
            ],
          },
        }}
        linkColorField={(d: { source?: { key?: string } }) => d.source?.key}
        style={{
          labelFontSize: 12,
          labelFontWeight: 500,
          labelFill: '#4a4a5a',
          labelSpacing: 8,
          linkFillOpacity: 0.6,
          linkFill: (d: { source?: { key?: string } }) =>
            resolveColor(String(d.source?.key ?? '')),
          nodeFill: (d: { key?: string }) => resolveColor(String(d.key ?? '')),
          nodeLineWidth: (d: { key?: string }) =>
            isSankeyHubNode(String(d.key ?? '')) ? HUB_EXTRA_WIDTH : 0,
          nodeStroke: (d: { key?: string }) => {
            const key = String(d.key ?? '');
            return isSankeyHubNode(key) ? resolveColor(key) : 'transparent';
          },
        }}
        tooltip={{
          title: (d: { key?: string; source?: { key?: string }; target?: { key?: string } }) =>
            d.key ?? d.source?.key ?? d.target?.key ?? '',
          items: [
            {
              field: 'value',
              name: '金额',
              valueFormatter: (v: number) =>
                formatCny(Number(v), { visible: amountsVisible }),
            },
          ],
        }}
      />
    </div>
  );
}
