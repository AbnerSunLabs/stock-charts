'use client';

import { GridPortfolioCard, toPortfolioCardView } from '@/components/grid/grid-portfolio-card';
import { formatGridAmount, formatSignedGridAmount } from '@/lib/grid/format-grid-amount';
import { extractEtfCode } from '@/lib/grid/grid-board-close-quote';
import { MOTION, isReducedMotion } from '@/lib/motion';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { fetchLatestEtfCloses, type EtfLatestClose } from '@/lib/supabase/etf-daily-repository';
import type { GridStrategyTrade } from '@/types/grid-strategy-trade';
import type { SavedGridStrategyV1 } from '@/types/grid-strategy-storage';
import { Card, Empty, Input, Select } from 'antd';
import { Flip } from 'gsap/Flip';
import { gsap } from 'gsap';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

/** 搜索防抖节流（交互节流时长，非动效时长，不走 motion token） */
const SEARCH_DEBOUNCE_MS = 150;

export interface GridPortfolioBoardProps {
  strategies: SavedGridStrategyV1[];
  trades: GridStrategyTrade[];
  loading?: boolean;
  /** 正在打开进计算器的策略 id，对应卡片按钮转 loading */
  openingStrategyId?: string | null;
  onOpenCalculator: (strategyId: string) => void;
  onOpenJournal: (strategyId: string) => void;
  onEdit?: (strategy: SavedGridStrategyV1) => void;
}

type BoardSort = 'maxLoss' | 'occupied';

/** Flip 前置状态：在触发重排的状态更新之前捕获（此时 DOM 仍是旧布局） */
type BoardFlipState = ReturnType<typeof Flip.getState>;

/** 看板 KPI 汇总值 */
interface BoardKpis {
  maxCapital: number;
  maxLoss: number;
  dd: number;
  realized: number;
  buyCost: number;
}

/**
 * 搜索防抖 + 应用前回调：连续敲键只应用最后一次，
 * onBeforeApply 用于在 setSearch 提交前捕获卡片旧位置（Flip 前置状态）。
 * 值未变化时跳过，避免残留过期的 Flip 前置状态。
 */
function useDebouncedSearch(onBeforeApply: () => void) {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const appliedRef = useRef('');

  useEffect(() => {
    if (searchInput === appliedRef.current) return;
    const timer = window.setTimeout(() => {
      appliedRef.current = searchInput;
      onBeforeApply();
      setSearch(searchInput);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchInput, onBeforeApply]);

  return { searchInput, setSearchInput, search };
}

/** 加载骨架：与真实 KPI/卡片同构（复用看板栅格），扫光走全局 .motion-skeleton */
function BoardSkeleton() {
  return (
    <div className="grid-portfolio-board" role="status" aria-busy="true">
      <p className="sr-only">正在加载组合看板…</p>
      <div className="grid-portfolio-board__summary">
        {[0, 1, 2, 3, 4].map(index => (
          <div key={index} className="grid-portfolio-board__sk-summary-item">
            <div className="motion-skeleton grid-portfolio-board__sk-bar grid-portfolio-board__sk-bar--label" />
            <div className="motion-skeleton grid-portfolio-board__sk-bar grid-portfolio-board__sk-bar--value" />
          </div>
        ))}
      </div>
      <div className="grid-portfolio-board__cards">
        {[0, 1, 2].map(index => (
          <div key={index} className="grid-portfolio-board__sk-card" aria-hidden>
            <div className="motion-skeleton grid-portfolio-board__sk-bar grid-portfolio-board__sk-bar--title" />
            <div className="grid-portfolio-board__sk-quotes">
              {[0, 1, 2].map(cell => (
                <div
                  key={cell}
                  className="motion-skeleton grid-portfolio-board__sk-quote"
                />
              ))}
            </div>
            <div className="motion-skeleton grid-portfolio-board__sk-bar grid-portfolio-board__sk-bar--line" />
            <div className="motion-skeleton grid-portfolio-board__sk-bar grid-portfolio-board__sk-bar--line" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** 顶部 KPI 汇总行：数值变化（收盘价到达/记账）以 small 档微闪淡入 */
function BoardSummaryRow({ kpis }: { kpis: BoardKpis }) {
  const items = [
    { label: '预计最大投入', value: formatGridAmount(kpis.maxCapital) },
    {
      label: '预计最大亏损',
      value: formatGridAmount(kpis.maxLoss),
      color: 'var(--loss)',
    },
    {
      label: '最大亏损幅度',
      value: `${kpis.dd.toFixed(1)}%`,
      color: 'var(--loss)',
    },
    {
      label: '已实现收益',
      value: formatSignedGridAmount(kpis.realized),
      color:
        kpis.realized > 0
          ? 'var(--profit)'
          : kpis.realized < 0
            ? 'var(--loss)'
            : undefined,
    },
    { label: '买入成本价', value: formatGridAmount(kpis.buyCost) },
  ];

  return (
    <div className="grid-portfolio-board__summary">
      {items.map(item => (
        <div
          key={item.label}
          className="grid-portfolio-board__summary-item rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--card)] p-4 shadow-[var(--ds-shadow-md)]"
        >
          <div className="mb-2 text-xs font-medium text-[var(--muted-foreground)]">
            {item.label}
          </div>
          <div
            key={item.value}
            className="grid-value-swap grid-portfolio-board__summary-value font-mono text-xl font-semibold tabular-nums tracking-tight"
            style={{ color: item.color ?? 'var(--foreground)' }}
          >
            {item.value}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * 组合看板：KPI + 策略卡片。搜索/排序重排用 GSAP Flip 平滑搬运。
 */
export function GridPortfolioBoard({
  strategies,
  trades,
  loading,
  openingStrategyId,
  onOpenCalculator,
  onOpenJournal,
  onEdit,
}: GridPortfolioBoardProps) {
  const [sort, setSort] = useState<BoardSort>('maxLoss');
  const [closes, setCloses] = useState<Map<string, EtfLatestClose>>(
    () => new Map()
  );
  const cardsRef = useRef<HTMLDivElement>(null);
  const flipStateRef = useRef<BoardFlipState | null>(null);

  useEffect(() => {
    const codes = Array.from(
      new Set(
        strategies
          .map(s => extractEtfCode(s.symbol))
          .filter((c): c is string => c != null)
      )
    );
    if (codes.length === 0) {
      setCloses(new Map());
      return;
    }
    let cancelled = false;
    void fetchLatestEtfCloses(createBrowserSupabaseClient(), codes)
      .then(map => {
        if (!cancelled) setCloses(map);
      })
      .catch(() => {
        if (!cancelled) setCloses(new Map());
      });
    return () => {
      cancelled = true;
    };
  }, [strategies]);

  const cards = useMemo(() => {
    return strategies.map(strategy => {
      const code = extractEtfCode(strategy.symbol);
      return toPortfolioCardView(strategy, trades, code ? closes.get(code) : undefined);
    });
  }, [strategies, trades, closes]);

  const kpis = useMemo<BoardKpis>(() => {
    let maxCapital = 0;
    let maxLoss = 0;
    let realized = 0;
    let buyCost = 0;
    for (const c of cards) {
      maxCapital += c.maxCapital;
      maxLoss += c.maxLoss;
      realized += c.latestProfit;
      buyCost += c.st.occupied;
    }
    const dd = maxCapital > 0 ? (maxLoss / maxCapital) * 100 : 0;
    return { maxCapital, maxLoss, dd, realized, buyCost };
  }, [cards]);

  /** 捕获卡片当前布局（必须在触发重排的 setState 之前调用） */
  const captureFlip = useCallback(() => {
    if (isReducedMotion() || !cardsRef.current) return;
    flipStateRef.current = Flip.getState(Array.from(cardsRef.current.children));
  }, []);

  const { searchInput, setSearchInput, search } = useDebouncedSearch(captureFlip);

  /** 排序切换：先捕获旧布局再改状态，提交后由 Flip.from 平滑搬运 */
  const handleSortChange = useCallback(
    (next: BoardSort) => {
      captureFlip();
      setSort(next);
    },
    [captureFlip]
  );

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = cards.filter(({ s }) => {
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) || s.symbol.toLowerCase().includes(q)
      );
    });
    return [...list].sort((a, b) =>
      sort === 'occupied'
        ? b.st.occupied - a.st.occupied
        : b.maxLoss - a.maxLoss
    );
  }, [cards, search, sort]);

  /* 搜索/排序重排：Flip 位移过渡；数据刷新等非用户触发的重排无前置状态，保持瞬时 */
  useLayoutEffect(() => {
    const state = flipStateRef.current;
    flipStateRef.current = null;
    if (!state || !cardsRef.current) return;
    Flip.from(state, {
      targets: Array.from(cardsRef.current.children),
      duration: MOTION.duration.medium,
      ease: MOTION.ease.standard,
      absolute: true,
      onEnter: elements =>
        gsap.fromTo(
          elements,
          { autoAlpha: 0 },
          {
            autoAlpha: 1,
            duration: MOTION.duration.small,
            ease: MOTION.ease.out,
          }
        ),
    });
  }, [visible]);

  if (!strategies.length && !loading) {
    return (
      <Card>
        <Empty description="还没有保存的策略，请先在计算器中生成并保存" />
      </Card>
    );
  }

  if (loading && !strategies.length) {
    return <BoardSkeleton />;
  }

  return (
    <div className="grid-portfolio-board">
      <BoardSummaryRow kpis={kpis} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="flex items-center gap-3 text-xs text-[var(--muted-foreground)]">
          <span>按策略平铺</span>
          <a
            className="grid-portfolio-board__ref"
            href="https://ashare.laoqianriritan.com/#panel-valuation"
            target="_blank"
            rel="noopener noreferrer"
          >
            宽基估值
          </a>
        </span>
        <div className="grid-portfolio-board__filters">
          <Select
            value={sort}
            onChange={handleSortChange}
            className="grid-portfolio-board__sort"
            options={[
              { value: 'maxLoss', label: '预计最大亏损' },
              { value: 'occupied', label: '已投入金额' },
            ]}
          />
          <Input.Search
            allowClear
            placeholder="搜索策略名或代码"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            className="grid-portfolio-board__search"
          />
        </div>
      </div>

      <div className="grid-portfolio-board__cards" ref={cardsRef}>
        {visible.map(view => (
          <GridPortfolioCard
            key={view.s.id}
            view={view}
            opening={openingStrategyId === view.s.id}
            onOpenCalculator={onOpenCalculator}
            onOpenJournal={onOpenJournal}
            onEdit={onEdit}
          />
        ))}
      </div>
    </div>
  );
}
