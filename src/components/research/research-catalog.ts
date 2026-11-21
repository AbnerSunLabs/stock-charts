/** 投研工具目录。侧栏按此列出，避免文案分叉。 */
export interface ResearchTool {
  href: string;
  label: string;
  category: string;
  description: string;
  detail: string;
  chart: 'sunburst' | 'grid' | 'levels';
  alt: string;
}

/** 现有三件投研工具，顺序即侧栏顺序。 */
export const RESEARCH_TOOLS: readonly ResearchTool[] = [
  {
    href: '/view/sunburst',
    label: '资产旭日图',
    category: '看配置',
    description: '各类持仓填上金额，钱放在哪儿，一张图看占比。',
    detail: 'A 股 · 海外成熟 · 海外新兴',
    chart: 'sunburst',
    alt: 'A 股、海外成熟和海外新兴的资产占比旭日图',
  },
  {
    href: '/view/grid',
    label: '网格交易策略',
    category: '定规矩',
    description: '价位和金额先写好。跌了照表买，涨了照表卖。',
    detail: '小网 · 中网 · 大网',
    chart: 'grid',
    alt: '网格交易档位与买卖交点',
  },
  {
    href: '/view/index-levels',
    label: '点位跟踪',
    category: '等时机',
    description: '记下想要的点位，每天拿收盘价对一遍，到了再动手。',
    detail: '收盘对照 · 市盈率分位',
    chart: 'levels',
    alt: '指数走势与买入、卖出点位',
  },
];

/** 首页和旧的工具一览地址进入的第一件工具。 */
export const RESEARCH_ENTRY_HREF = RESEARCH_TOOLS[0].href;

/**
 * 按当前路径选出侧栏高亮项。
 * 对不上任何工具时不点亮菜单。
 */
export function resolveResearchMenuKey(pathname: string): string {
  const tool = RESEARCH_TOOLS.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
  return tool?.href ?? '';
}
