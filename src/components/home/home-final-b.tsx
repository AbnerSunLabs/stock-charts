'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { App } from 'antd';
import { LoginModal } from '@/components/auth/login-modal';
import { ChangliuMark } from '@/components/brand/changliu-mark';
import { RESEARCH_ENTRY_HREF } from '@/components/research/research-catalog';
import { checkFamilyAccess, signOut } from '@/lib/supabase/auth';

const moneyFills = [
  ...Array(22).fill('#e58a3f'),
  ...Array(30).fill('#ee9f5c'),
  ...Array(36).fill('#f6c798'),
  ...Array(12).fill('#f9dcbd'),
];

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

/** 旧书签 `#tools` 改去第一件投研工具。 */
function useLegacyToolsRedirect(): void {
  const router = useRouter();
  useEffect(() => {
    if (window.location.hash === '#tools') {
      router.replace(RESEARCH_ENTRY_HREF);
    }
  }, [router]);
}

export function HomeFinalB() {
  const router = useRouter();
  const { message } = App.useApp();
  const [loginOpen, setLoginOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  useLegacyToolsRedirect();

  const enterFamily = async () => {
    if (checking) return;
    setChecking(true);
    try {
      const result = await checkFamilyAccess();
      if (result.allowed) {
        router.push('/view/family');
        return;
      }
      if (result.reason === 'error') {
        // 校验请求本身失败：保留会话，提示重试，而不是把人登出
        message.warning('暂时无法验证访问权限，请稍后重试');
        return;
      }
      if (result.session) await signOut();
      setLoginOpen(true);
    } catch {
      message.warning('暂时无法验证访问权限，请稍后重试');
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="home-final-b">
      <div className="backdrop" aria-hidden="true"><div className="backdrop-glow backdrop-warm" /><div className="backdrop-glow backdrop-cool" /><div className="backdrop-glow backdrop-lilac" /></div>
      <header className="site-header">
        <div className="container header-inner">
          <a className="brand" href="/" aria-label="长流首页">
            <ChangliuMark />
            <span className="brand-name">长流</span><span className="brand-note">细水，才能长流</span>
          </a>
        </div>
      </header>
      <main>
        <section id="home-screen" className="container" aria-label="首页导航">
          <div className="intro home-intro"><h1><span className="h-line"><span className="h-strong">家里的账</span><span className="h-soft">要清，</span></span><span className="h-line"><span className="h-strong">手里的仓</span><span className="h-soft">要稳。</span></span></h1><p>不猜涨跌。钱记清楚，买卖的规矩提前写好，剩下的交给时间。</p></div>
          <div className="diptych">
            <button
              type="button"
              className="feature-panel feature-family"
              aria-busy={checking}
              onClick={() => void enterFamily()}
            >
              <div className="panel-kicker"><strong>家里的账</strong></div>
              <div className="paper-space"><FamilyPaper /></div>
              <div className="panel-footer"><div className="panel-copy"><h2>家庭财务</h2><p>资产负债 · 四笔钱 · 保单 · 流水</p></div><span className="panel-button">{checking ? '正在验证…' : '打开家账'}{checking ? null : <Arrow />}</span></div>
            </button>
            <a className="feature-panel feature-tools" href={RESEARCH_ENTRY_HREF}>
              <div className="panel-kicker"><strong>手里的仓</strong></div>
              <div className="paper-space"><MiniCharts /></div>
              <div className="panel-footer"><div className="panel-copy"><h2>投研工具</h2><p>资产旭日图 · 网格交易策略 · 点位跟踪</p></div><span className="panel-button">挑一件工具<Arrow /></span></div>
            </a>
          </div>
        </section>
      </main>
      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} redirectTo="/view/family" />
    </div>
  );
}
