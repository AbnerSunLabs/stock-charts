'use client';

import { GridPortfolioCard, toPortfolioCardView } from '@/components/grid/grid-portfolio-card';
import { formatGridAmount, formatSignedGridAmount } from '@/lib/grid/format-grid-amount';
import { extractEtfCode } from '@/lib/grid/grid-board-close-quote';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { fetchLatestEtfCloses, type EtfLatestClose } from '@/lib/supabase/etf-daily-repository';
import type { GridStrategyTrade } from '@/types/grid-strategy-trade';
import type { SavedGridStrategyV1 } from '@/types/grid-strategy-storage';
import { Card, Empty, Input, Select, Space } from 'antd';
import { useEffect, useMemo, useState } from 'react';

export interface GridPortfolioBoardProps {
  strategies: SavedGridStrategyV1[];
  trades: GridStrategyTrade[];
  loading?: boolean;
  onOpenCalculator: (strategyId: string) => void;
  onOpenJournal: (strategyId: string) => void;
  onEdit?: (strategy: SavedGridStrategyV1) => void;
}

type BoardSort = 'maxLoss' | 'occupied';

/**
 * 组合看板：KPI + 策略卡片。
 */
export function GridPortfolioBoard({
  strategies,
  trades,
  loading,
  onOpenCalculator,
  onOpenJournal,
  onEdit,
}: GridPortfolioBoardProps) {
  const [sort, setSort] = useState<BoardSort>('maxLoss');
  const [search, setSearch] = useState('');
  const [closes, setCloses] = useState<Map<string, EtfLatestClose>>(
    () => new Map()
  );

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

  const kpis = useMemo(() => {
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

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = cards.filter(({ s }) => {
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) || s.symbol.toLowerCase().includes(q)
      );
    });
    list = [...list].sort((a, b) =>
      sort === 'occupied'
        ? b.st.occupied - a.st.occupied
        : b.maxLoss - a.maxLoss
    );
    return list;
  }, [cards, search, sort]);

  if (!strategies.length && !loading) {
    return (
      <Card>
        <Empty description="尚无保存策略，请先在计算器中生成并保存" />
      </Card>
    );
  }

  if (loading && !strategies.length) {
    return (
      <Card>
        <Empty description="加载中…" />
      </Card>
    );
  }

  return (
    <Space direction="vertical" size={16} className="w-full">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {[
          { label: '预计最大投入', value: formatGridAmount(kpis.maxCapital) },
          {
            label: '预计最大亏损',
            value: formatGridAmount(kpis.maxLoss),
            color: 'var(--loss)',
          },
          {
            label: '组合跌幅%',
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
        ].map(item => (
          <div
            key={item.label}
            className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--card)] p-4 shadow-[var(--ds-shadow-md)]"
          >
            <div className="mb-2 text-xs font-medium text-[var(--muted-foreground)]">
              {item.label}
            </div>
            <div
              className="font-mono text-xl font-semibold tabular-nums tracking-tight"
              style={{ color: item.color ?? 'var(--foreground)' }}
            >
              {item.value}
            </div>
          </div>
        ))}
      </div>

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
        <Space wrap>
          <Select
            value={sort}
            onChange={v => setSort(v)}
            style={{ width: 160 }}
            options={[
              { value: 'maxLoss', label: '预计最大亏损' },
              { value: 'occupied', label: '已投入金额' },
            ]}
          />
          <Input.Search
            allowClear
            placeholder="搜索标的..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: 200 }}
          />
        </Space>
      </div>

      <div className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visible.map(view => (
          <GridPortfolioCard
            key={view.s.id}
            view={view}
            onOpenCalculator={onOpenCalculator}
            onOpenJournal={onOpenJournal}
            onEdit={onEdit}
          />
        ))}
      </div>
    </Space>
  );
}
