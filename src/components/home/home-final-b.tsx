'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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

interface MiniChartProps {
  src: string;
  alt: string;
  label: string;
}

/**
 * 单张迷你图：图片从网络到达时做一次淡入，交代「内容来了」，
 * 避免右侧纸片内部突然被填充的硬切；高度固定 150px，不产生布局抖动。
 */
function MiniChart({ src, alt, label }: MiniChartProps) {
  const [loaded, setLoaded] = useState(false);
  // 命中缓存的图片可能在 React 挂载前就已完成加载，onLoad 不会再触发，
  // 因此挂载时同步检查 complete，直接落在「已到达」终态。
  const syncCachedImage = (img: HTMLImageElement | null): void => {
    if (img?.complete) setLoaded(true);
  };
  return (
    <div className={loaded ? 'mini-chart is-loaded' : 'mini-chart'}>
      <Image src={src} alt={alt} width={120} height={120} unoptimized onLoad={() => setLoaded(true)} ref={syncCachedImage} />
      <span>{label}</span>
    </div>
  );
}

function MiniCharts() {
  return (
    <div className="chart-paper tools-paper">
      <MiniChart src="/home-final-b/sunburst-mini.svg" alt="资产占比旭日图" label="旭日图" />
      <MiniChart src="/home-final-b/grid-mini.svg" alt="网格买卖档位" label="网格" />
      <MiniChart src="/home-final-b/levels-mini.svg" alt="指数买卖点位" label="点位" />
    </div>
  );
}

interface FamilyPanelProps {
  /** 是否处于「正在核验」pending 态。 */
  checking: boolean;
  onEnter: () => void;
}

/** 家庭入口面板：点击「打开家账」立即进入 pending 态（禁用防连点、箭头换轻量转圈、文案切「正在核验…」）。 */
function FamilyPanel({ checking, onEnter }: FamilyPanelProps) {
  return (
    <button
      type="button"
      className={checking ? 'feature-panel feature-family is-checking motion-enter--card' : 'feature-panel feature-family motion-enter--card'}
      onClick={onEnter}
      disabled={checking}
      aria-busy={checking}
    >
      <div className="panel-kicker"><strong>家里的账</strong></div>
      <div className="paper-space"><FamilyPaper /></div>
      <div className="panel-footer"><div className="panel-copy"><h2>家庭财务</h2><p>资产负债 · 四笔钱 · 保单 · 流水</p></div><span className="panel-button">{checking ? '正在核验…' : '打开家账'}<span className="panel-button-icon" aria-hidden="true"><Arrow /><span className="panel-spinner" /></span></span></div>
    </button>
  );
}

/** 投研工具面板：next/link 客户端导航，与家庭入口统一为 SPA 跳转（不整页刷新重播背景漂移）。 */
function ToolsPanel() {
  return (
    <Link className="feature-panel feature-tools motion-enter--card" href={RESEARCH_ENTRY_HREF}>
      <div className="panel-kicker"><strong>手里的仓</strong></div>
      <div className="paper-space"><MiniCharts /></div>
      <div className="panel-footer"><div className="panel-copy"><h2>投研工具</h2><p>资产旭日图 · 网格交易策略 · 点位跟踪</p></div><span className="panel-button">挑一件工具<span className="panel-button-icon" aria-hidden="true"><Arrow /></span></span></div>
    </Link>
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

/**
 * 页面是否处于后台标签：背景柔光的漂移动画据此暂停/恢复，
 * 避免不可见时仍持续占用三个大合成层。
 */
function useDocumentHidden(): boolean {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const sync = (): void => setHidden(document.hidden);
    document.addEventListener('visibilitychange', sync);
    sync();
    return () => document.removeEventListener('visibilitychange', sync);
  }, []);
  return hidden;
}

export function HomeFinalB() {
  const router = useRouter();
  const [loginOpen, setLoginOpen] = useState(false);
  /** 「打开家账」核验中：按钮禁用 + 箭头换转圈 + 文案「正在核验…」，请求结束自动复位。 */
  const [checkingFamily, setCheckingFamily] = useState(false);
  const documentHidden = useDocumentHidden();
  useLegacyToolsRedirect();

  const enterFamily = async (): Promise<void> => {
    if (checkingFamily) return;
    setCheckingFamily(true);
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
    } finally {
      setCheckingFamily(false);
    }
  };

  return (
    <div className="home-final-b">
      <div className={documentHidden ? 'backdrop is-paused' : 'backdrop'} aria-hidden="true"><div className="backdrop-glow backdrop-warm" /><div className="backdrop-glow backdrop-cool" /><div className="backdrop-glow backdrop-lilac" /></div>
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
          <div className="intro home-intro motion-enter--card"><h1><span className="h-line"><span className="h-strong">家里的账</span><span className="h-soft">要清，</span></span><span className="h-line"><span className="h-strong">手里的仓</span><span className="h-soft">要稳。</span></span></h1><p>不猜涨跌。钱记清楚，买卖的规矩提前写好，剩下的交给时间。</p></div>
          <div className="diptych">
            <FamilyPanel checking={checkingFamily} onEnter={() => void enterFamily()} />
            <ToolsPanel />
          </div>
        </section>
      </main>
      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} redirectTo="/view/family" />
    </div>
  );
}
