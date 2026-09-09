'use client';

import {
  computeStrategyTradeStats,
  estimateMaxLoss,
} from '@/lib/grid/grid-strategy-trade-stats';
import type { GridStrategyTrade } from '@/types/grid-strategy-trade';
import type { SavedGridStrategyV1 } from '@/types/grid-strategy-storage';
import { Button, Card, Empty, Input, Select, Space, Tag } from 'antd';
import { useMemo, useState } from 'react';

export interface GridPortfolioBoardProps {
  strategies: SavedGridStrategyV1[];
  trades: GridStrategyTrade[];
  loading?: boolean;
  onOpenCalculator: (strategyId: string) => void;
  onOpenJournal: (strategyId: string) => void;
}

type BoardSort = 'maxLoss' | 'occupied';

function money(n: number): string {
  return n.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * 组合看板：KPI + 策略卡片。
 */
export function GridPortfolioBoard({
  strategies,
  trades,
  loading,
  onOpenCalculator,
  onOpenJournal,
}: GridPortfolioBoardProps) {
  const [sort, setSort] = useState<BoardSort>('maxLoss');
  const [search, setSearch] = useState('');

  const cards = useMemo(() => {
    return strategies.map(s => {
      const levelKeys = s.resultSnapshot.legs.map(l => l.id);
      const st = computeStrategyTradeStats(
        trades.filter(t => t.strategyId === s.id),
        levelKeys
      );
      const stress = s.resultSnapshot.stressTest;
      const totalBuy = stress?.totalBuyAmount ?? 0;
      const remain = stress?.remainingShares ?? 0;
      const maxCapital =
        stress?.v2?.totalBudgetRequired ?? stress?.totalBuyAmount ?? 0;
      const maxLoss = estimateMaxLoss(
        totalBuy,
        remain,
        s.config.params.minPrice
      );
      return { s, st, maxCapital, maxLoss };
    });
  }, [strategies, trades]);

  const kpis = useMemo(() => {
    let maxCapital = 0;
    let maxLoss = 0;
    let realized = 0;
    let mv = 0;
    for (const c of cards) {
      maxCapital += c.maxCapital;
      maxLoss += c.maxLoss;
      realized += c.st.realized;
      mv += c.st.openShares * c.s.config.params.basePrice;
    }
    const dd = maxCapital > 0 ? (maxLoss / maxCapital) * 100 : 0;
    return { maxCapital, maxLoss, dd, realized, mv };
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
          { label: '预计最大投入', value: money(kpis.maxCapital) },
          {
            label: '预计最大亏损',
            value: money(kpis.maxLoss),
            color: 'var(--loss)',
          },
          {
            label: '组合跌幅%',
            value: `${kpis.dd.toFixed(1)}%`,
            color: 'var(--loss)',
          },
          {
            label: '已实现收益',
            value: `${kpis.realized >= 0 ? '+' : ''}${money(kpis.realized)}`,
            color:
              kpis.realized > 0
                ? 'var(--profit)'
                : kpis.realized < 0
                  ? 'var(--loss)'
                  : undefined,
          },
          { label: '持仓市值粗估', value: money(kpis.mv) },
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
        <span className="text-xs text-[var(--muted-foreground)]">
          按策略平铺
        </span>
        <Space wrap>
          <Select
            value={sort}
            onChange={v => setSort(v)}
            style={{ width: 160 }}
            options={[
              { value: 'maxLoss', label: '预计最大亏损' },
              { value: 'occupied', label: '已占用弹药' },
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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visible.map(({ s, st, maxLoss }) => (
          <Card
            key={s.id}
            title={
              <span>
                {s.name}
                {s.symbol ? (
                  <span className="ml-2 font-mono text-sm font-normal text-[var(--muted-foreground)]">
                    {s.symbol}
                  </span>
                ) : null}
              </span>
            }
          >
            <Space direction="vertical" size={8} className="w-full">
              <div className="flex justify-between text-sm">
                <span className="text-[var(--muted-foreground)]">
                  预计最大亏损
                </span>
                <span
                  className="font-mono tabular-nums"
                  style={{ color: 'var(--loss)' }}
                >
                  {money(maxLoss)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[var(--muted-foreground)]">
                  已占用弹药
                </span>
                <span className="font-mono tabular-nums">
                  {money(st.occupied)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[var(--muted-foreground)]">
                  已实现收益
                </span>
                <span
                  className="font-mono tabular-nums"
                  style={{
                    color:
                      st.realized > 0
                        ? 'var(--profit)'
                        : st.realized < 0
                          ? 'var(--loss)'
                          : undefined,
                  }}
                >
                  {st.realized >= 0 ? '+' : ''}
                  {money(st.realized)}
                </span>
              </div>
              <Tag color="processing">
                持仓中 {st.openLevels}/{st.totalLevels}，累计 {st.rounds} 轮
              </Tag>
              <Space>
                <Button
                  type="primary"
                  shape="round"
                  onClick={() => onOpenCalculator(s.id)}
                >
                  打开计算器
                </Button>
                <Button shape="round" onClick={() => onOpenJournal(s.id)}>
                  流水
                </Button>
              </Space>
            </Space>
          </Card>
        ))}
      </div>
    </Space>
  );
}
