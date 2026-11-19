'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { LoginModal } from '@/components/auth/login-modal';
import { checkFamilyAccess, signOut } from '@/lib/supabase/auth';

const moneyFills = [
  ...Array(22).fill('#e58a3f'),
  ...Array(30).fill('#ee9f5c'),
  ...Array(36).fill('#f6c798'),
  ...Array(12).fill('#f9dcbd'),
];

const tools = [
  { href: '/view/sunburst', chart: 'sunburst', alt: 'A 股、海外成熟和海外新兴的资产占比旭日图', category: '看配置', title: '资产旭日图', description: '各类持仓填上金额，钱放在哪儿，一张图看占比。', detail: 'A 股 · 海外成熟 · 海外新兴' },
  { href: '/view/grid', chart: 'grid', alt: '网格交易档位与买卖交点', category: '定规矩', title: '网格交易策略', description: '价位和金额先写好。跌了照表买，涨了照表卖。', detail: '小网 · 中网 · 大网' },
  { href: '/view/index-levels', chart: 'levels', alt: '指数走势与买入、卖出点位', category: '等时机', title: '点位跟踪', description: '记下想要的点位，每天拿收盘价对一遍，到了再动手。', detail: '收盘对照 · 市盈率分位' },
] as const;

function Arrow() {
  return <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 8h10M8.5 4l4 4-4 4" /></svg>;
}

function FamilyPaper() {
  return (
    <div className="chart-paper family-paper">
      <div className="paper-head">
        <span className="paper-title">家庭总资产</span>
        <svg className="eye-off" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 6.2C3.5 4.8 5.5 4 8 4c2.5 0 4.5.8 6 2.2M2 9.8C3.5 11.2 5.5 12 8 12c2.5 0 4.5-.8 6-2.2M8 6.5a1.5 1.5 0 0 0-1.5 1.5M2 14 14 2" /></svg>
      </div>
      <div className="hidden-balance" aria-label="金额已隐藏"><span aria-hidden="true">¥</span><span className="balance-dots" aria-hidden="true">{Array.from({ length: 6 }, (_, index) => <i key={index} />)}</span></div>
      <div className="waffle money-waffle" aria-hidden="true">{moneyFills.map((fill, index) => <i key={index} style={{ background: fill }} />)}</div>
      <div className="legend legend-money"><span><i />活钱</span><span><i />稳钱</span><span><i />长钱</span><span><i />保障</span></div>
      <div className="family-divider" />
      <div className="waffle net-waffle" aria-hidden="true">{Array.from({ length: 25 }, (_, index) => <i key={index} className={index < 7 ? undefined : 'is-hollow'} style={index < 7 ? { background: '#dcdde8' } : undefined} />)}</div>
      <div className="legend legend-net"><span><i />负债</span><span><i />净资产</span></div>
    </div>
  );
}

function MiniCharts() {
  return (
    <div className="chart-paper tools-paper">
      <div className="mini-chart"><Image src="/home-final-b/sunburst-mini.svg" alt="资产占比旭日图" width={120} height={120} unoptimized /><span>旭日图</span></div>
      <div className="mini-chart"><Image src="/home-final-b/grid-mini.svg" alt="网格买卖档位" width={120} height={120} unoptimized /><span>网格</span></div>
      <div className="mini-chart"><Image src="/home-final-b/levels-mini.svg" alt="指数买卖点位" width={120} height={120} unoptimized /><span>点位</span></div>
    </div>
  );
}

export function HomeFinalB() {
  const router = useRouter();
  const [showTools, setShowTools] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);

  useEffect(() => {
    const syncScreen = () => {
      setShowTools(window.location.hash === '#tools');
      window.scrollTo(0, 0);
    };
    syncScreen();
    window.addEventListener('hashchange', syncScreen);
    window.addEventListener('popstate', syncScreen);
    return () => {
      window.removeEventListener('hashchange', syncScreen);
      window.removeEventListener('popstate', syncScreen);
    };
  }, []);

  const enterFamily = async () => {
    try {
      const result = await checkFamilyAccess();
      if (result.allowed) {
        router.push('/view/family');
        return;
      }
      if (result.session) await signOut();
      setLoginOpen(true);
    } catch {
      setLoginOpen(true);
    }
  };

  const returnHome = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    window.history.pushState(null, '', window.location.pathname + window.location.search);
    setShowTools(false);
    window.scrollTo(0, 0);
  };

  return (
    <div className="home-final-b">
      <div className="backdrop" aria-hidden="true"><div className="backdrop-glow backdrop-warm" /><div className="backdrop-glow backdrop-cool" /><div className="backdrop-glow backdrop-lilac" /></div>
      <header className="site-header">
        <div className="container header-inner">
          <a className="brand" href="/" aria-label="长流首页">
            <svg viewBox="0 0 48 48" width="26" height="26" aria-hidden="true"><path d="M5 31 C 9 25, 13 25, 17 31 S 25 37, 29 31 S 35 19, 40.5 15.5" fill="none" stroke="#4f46e5" strokeWidth="3.5" strokeLinecap="round" /><circle cx="41" cy="15" r="4.5" fill="#ee9f5c" /></svg>
            <span className="brand-name">长流</span><span className="brand-note">细水，才能长流</span>
          </a>
        </div>
      </header>
      <main>
        <section id="home-screen" className="container" aria-label="首页导航" hidden={showTools}>
          <div className="intro home-intro"><h1><span className="h-line"><span className="h-strong">家里的账</span><span className="h-soft">要清，</span></span><span className="h-line"><span className="h-strong">手里的仓</span><span className="h-soft">要稳。</span></span></h1><p>不猜涨跌。钱记清楚，买卖的规矩提前写好，剩下的交给时间。</p></div>
          <div className="diptych">
            <button type="button" className="feature-panel feature-family" onClick={() => void enterFamily()}>
              <div className="panel-kicker"><strong>家里的账</strong></div>
              <div className="paper-space"><FamilyPaper /></div>
              <div className="panel-footer"><div className="panel-copy"><h2>家庭财务</h2><p>资产负债 · 四笔钱 · 保单 · 流水</p></div><span className="panel-button">打开家账<Arrow /></span></div>
            </button>
            <a className="feature-panel feature-tools" href="#tools">
              <div className="panel-kicker"><strong>手里的仓</strong></div>
              <div className="paper-space"><MiniCharts /></div>
              <div className="panel-footer"><div className="panel-copy"><h2>投研工具</h2><p>资产旭日图 · 网格交易策略 · 点位跟踪</p></div><span className="panel-button">挑一件工具<Arrow /></span></div>
            </a>
          </div>
        </section>
        <section id="tools-screen" className="container" aria-label="投研工具" hidden={!showTools}>
          <a className="back-link" href="#" onClick={returnHome}>← 回到首页</a>
          <div className="intro tools-intro"><h1><span className="h-strong">每件工具，</span><span className="h-soft">只管一件事。</span></h1><p>看配置，定规矩，等时机。工具会慢慢添。</p></div>
          <div className="tool-grid">{tools.map(tool => (
            <a className="tool-card" href={tool.href} key={tool.href}>
              <div className="tool-visual"><Image src={`/home-final-b/${tool.chart}-large.svg`} data-chart={tool.chart} alt={tool.alt} width={tool.chart === 'grid' ? 360 : 320} height={tool.chart === 'grid' ? 250 : 230} unoptimized /></div>
              <div className="tool-content"><div className="tool-category">{tool.category}</div><h2>{tool.title}</h2><p className="tool-description">{tool.description}</p><div className="tool-bottom"><span>{tool.detail}</span><span className="tool-arrow" aria-hidden="true">→</span></div></div>
            </a>
          ))}</div>
        </section>
      </main>
      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} redirectTo="/view/family" />
    </div>
  );
}
