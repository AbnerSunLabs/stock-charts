import type { Metadata } from 'next';
import { Noto_Sans_SC, Noto_Serif_SC } from 'next/font/google';

import './index-levels.css';

const sans = Noto_Sans_SC({
  weight: ['400', '500', '600'],
  subsets: ['latin'],
  variable: '--font-index-sans',
  display: 'swap',
});

const serif = Noto_Serif_SC({
  weight: '600',
  subsets: ['latin'],
  variable: '--font-index-serif',
  display: 'swap',
});

export const metadata: Metadata = {
  title: '点位跟踪 | 投资图表',
  description: '用官方收盘对照跟踪指数的判断点位',
};

/**
 * 点位跟踪自有刻度样式，不借用网格页的卡片皮肤。
 */
export default function IndexLevelsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className={`${sans.variable} ${serif.variable} index-levels`}>{children}</div>;
}
