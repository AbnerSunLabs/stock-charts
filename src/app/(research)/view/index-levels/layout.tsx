import type { Metadata } from 'next';
import { Spline_Sans_Mono } from 'next/font/google';

import './index-levels.css';

export const metadata: Metadata = {
  title: '点位跟踪 | 投资图表',
  description: '用官方收盘对照跟踪指数的判断点位',
};

/** 数码读数字体：表盘大数、速览数值、坐标轴与代码标签用，中文仍走系统栈。 */
const numericFont = Spline_Sans_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-spline',
  display: 'swap',
});

/**
 * 点位跟踪自有点位页样式：海拔仪表盘语言，暖白记录纸配绿墨与刻线。
 */
export default function IndexLevelsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className={`index-levels ${numericFont.variable}`}>{children}</div>;
}
