import type { Metadata } from 'next';
import { HomeFinalB } from '@/components/home/home-final-b';
import './home-final-b.css';

export const metadata: Metadata = {
  title: '长流 · 家账与投资手记',
  description: '家里的账要清，手里的仓要稳。',
  icons: { icon: '/home-final-b/favicon.svg' },
};

export default function HomePage() {
  return <HomeFinalB />;
}
