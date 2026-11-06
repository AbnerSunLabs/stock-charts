import type { Metadata } from 'next';

import './index-levels.css';

export const metadata: Metadata = {
  title: '点位跟踪 | 投资图表',
  description: '用官方收盘对照跟踪指数的判断点位',
};

/**
 * 点位跟踪自有点位页样式，沿用系统字体，不借用网格页的卡片皮肤。
 */
export default function IndexLevelsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="index-levels">{children}</div>;
}
