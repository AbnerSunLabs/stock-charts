import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '仓位分布（旭日图）',
  description: '投资仓位分布旭日图，按持仓占比与结构可视化展示。',
  openGraph: {
    title: '仓位分布（旭日图） | 仓位视图',
    description: '投资仓位分布旭日图，按持仓占比与结构可视化展示。',
    type: 'website',
    locale: 'zh_CN',
  },
  twitter: {
    card: 'summary_large_image',
    title: '仓位分布（旭日图） | 仓位视图',
    description: '投资仓位分布旭日图，按持仓占比与结构可视化展示。',
  },
};

export default function SunburstLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
