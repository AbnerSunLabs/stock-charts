import type { Metadata } from 'next';
import './grid.css';

export const metadata: Metadata = {
  title: '网格交易策略 | 投资图表',
  description: '配置网格步长与资金系数，生成策略并推演抗跌优势',
};

/**
 * 网格策略页布局：独立字体与设计体系，不影响首页与 view 面包屑对齐。
 */
export default function GridLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="grid-shell">{children}</div>;
}
