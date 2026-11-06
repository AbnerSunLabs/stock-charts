/** 首页工具卡片网格，用于展示各投研工具入口。 */
'use client';

import { useRouter } from 'next/navigation';
import { Row, Col } from 'antd';
import { HomeToolCard } from './home-tool-card';

const TOOLS = [
  {
    id: 'sunburst',
    title: '资产旭日图',
    description: '按分类填写持仓金额，自动生成占比旭日图并支持下载 PNG',
    href: '/view/sunburst',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
        <circle cx="12" cy="12" r="3" fill="currentColor" />
        <circle cx="12" cy="12" r="6" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.6" />
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.35" />
      </svg>
    ),
  },
  {
    id: 'grid',
    title: '网格交易策略',
    description: '配置小/中/大网步长与资金系数，生成网格档位并推演抗跌优势',
    href: '/view/grid',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
        <path d="M4 4h7v7H4V4zM13 4h7v7h-7V4zM4 13h7v7H4v-7zM13 13h7v7h-7v-7z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M7.5 7.5h.01M16.5 7.5h.01M7.5 16.5h.01M16.5 16.5h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'index-levels',
    title: '点位跟踪',
    description: '用官方收盘对照跟踪指数的判断点位',
    href: '/view/index-levels',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
        <path d="M4 16h16M4 12h10M4 8h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="17" cy="8" r="2" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    id: 'coming-soon-2',
    title: '持仓分析',
    description: '多维度分析股票持仓结构，行业分布、市值风格一键洞察',
    href: '#',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
        <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
      </svg>
    ),
    coming: true,
  },
  {
    id: 'coming-soon-3',
    title: '风险仪表盘',
    description: '一屏展示波动率、最大回撤、夏普比率等核心风险指标',
    href: '#',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
        <path d="M12 2V6M12 18V22M4.93 4.93L7.76 7.76M16.24 16.24L19.07 19.07M2 12H6M18 12H22M4.93 19.07L7.76 16.24M16.24 7.76L19.07 4.93" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
    coming: true,
  },
] as const;

/**
 * 投研工具分区网格。
 */
export function HomeToolGrid() {
  const router = useRouter();

  return (
    <section>
      <h2 className="font-[var(--font-display)] text-sm font-semibold tracking-wide text-[var(--text-muted)] uppercase m-0 mb-4">
        投研工具
      </h2>
      <Row gutter={[20, 20]} className="mt-0">
        {TOOLS.map((tool, index) => (
          <Col xs={24} sm={12} lg={6} key={tool.id}>
            <HomeToolCard
              title={tool.title}
              description={tool.description}
              icon={tool.icon}
              animationDelay={`${0.12 + index * 0.04}s`}
              coming={'coming' in tool && tool.coming}
              onAction={() => {
                if (!('coming' in tool && tool.coming)) router.push(tool.href);
              }}
            />
          </Col>
        ))}
      </Row>
    </section>
  );
}
