'use client';

import {
  formatGridAmount,
  formatGridPrice,
  formatSignedGridAmount,
} from '@/lib/grid/format-grid-amount';
import {
  buildBoardQuoteLevels,
  describeBoardDistance,
  extractEtfCode,
  formatCloseMonthDay,
  pickLatestAwaitingSellPrice,
  pickNearestUnboughtBuyPrice,
  type BoardDistanceView,
} from '@/lib/grid/grid-board-close-quote';
import {
  computeStrategyTradeStats,
  estimateMaxLossFromSnapshot,
} from '@/lib/grid/grid-strategy-trade-stats';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import {
  fetchLatestEtfCloses,
  type EtfLatestClose,
} from '@/lib/supabase/etf-daily-repository';
import type { GridStrategyTrade } from '@/types/grid-strategy-trade';
import type { SavedGridStrategyV1 } from '@/types/grid-strategy-storage';
import { EditOutlined } from '@ant-design/icons';
import { Button, Card, Empty, Input, Select, Space, Tag, Tooltip } from 'antd';
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

function MarketCell({
  label,
  view,
  closeText,
}: {
  label: string;
  view?: BoardDistanceView;
  closeText?: string;
}) {
  const tone = view?.tone ?? 'empty';
  const main = closeText ?? view?.main ?? '—';
  const sub = view?.sub;
  const mainClass = closeText
    ? 'grid-portfolio-card__quote-main'
    : `grid-portfolio-card__quote-main grid-portfolio-card__quote-main--${tone}`;
  return (
    <div className="grid-portfolio-card__quote-cell">
      <div className="grid-portfolio-card__quote-k">{label}</div>
      <div className={mainClass}>{main}</div>
      {sub ? (
        <div className="grid-portfolio-card__quote-sub">{sub}</div>
      ) : null}
    </div>
  );
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
    return strategies.map(s => {
      const levelKeys = s.resultSnapshot.legs.map(l => l.id);
      const strategyTrades = trades.filter(t => t.strategyId === s.id);
      const st = computeStrategyTradeStats(strategyTrades, levelKeys);
      const stress = s.resultSnapshot.stressTest;
      const maxCapital =
        stress?.v2?.totalBudgetRequired ?? stress?.totalBuyAmount ?? 0;
      const maxLoss = estimateMaxLossFromSnapshot(
        stress,
        s.config.params.minPrice
      );
      const priceUnit = s.config.params.priceUnit;
      const quoteCode = extractEtfCode(s.symbol);
      const quote = quoteCode ? closes.get(quoteCode) : undefined;
      const close = quote?.close ?? null;
      const levels = buildBoardQuoteLevels(
        s.resultSnapshot.legs,
        strategyTrades
      );
      const buyAnchor =
        close == null ? null : pickNearestUnboughtBuyPrice(close, levels);
      const sellAnchor =
        close == null
          ? null
          : pickLatestAwaitingSellPrice(levels, strategyTrades);
      return {
        s,
        st,
        maxCapital,
        maxLoss,
        closeLabel: quote
          ? `收盘 ${formatCloseMonthDay(quote.tradeDate)}`
          : '收盘',
        closeText:
          close == null ? '—' : formatGridPrice(close, priceUnit),
        buyView: describeBoardDistance(close, buyAnchor, priceUnit),
        sellView: describeBoardDistance(close, sellAnchor, priceUnit),
      };
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
      realized += c.st.realized;
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
        {visible.map(
          ({ s, st, maxLoss, closeLabel, closeText, buyView, sellView }) => (
            <Card
              key={s.id}
              className="grid-portfolio-card"
              title={
                <span className="grid-portfolio-card__title">
                  <span className="grid-portfolio-card__title-text">
                    {s.name}
                    {s.symbol ? (
                      <span className="ml-2 font-mono text-sm font-normal text-[var(--muted-foreground)]">
                        {s.symbol}
                      </span>
                    ) : null}
                  </span>
                  {onEdit ? (
                    <Button
                      type="text"
                      size="small"
                      className="grid-portfolio-card__edit"
                      icon={<EditOutlined />}
                      aria-label="编辑"
                      onClick={() => onEdit(s)}
                    />
                  ) : null}
                </span>
              }
              extra={
                <Tag color="processing" className="m-0">
                  持仓中 {st.openLevels}/{st.totalLevels}，累计 {st.rounds} 轮
                </Tag>
              }
            >
              <Space direction="vertical" size={8} className="w-full">
                <div className="grid-portfolio-card__note">
                  {s.note ? (
                    <Tooltip title={s.note} placement="topLeft">
                      <span className="grid-portfolio-card__note-text">
                        <Tag color="blue" className="m-0">
                          {s.note}
                        </Tag>
                      </span>
                    </Tooltip>
                  ) : null}
                </div>
                <div className="grid-portfolio-card__quotes">
                  <MarketCell label={closeLabel} closeText={closeText} />
                  <MarketCell label="下一买" view={buyView} />
                  <MarketCell label="下一卖" view={sellView} />
                </div>
                <div className="grid-portfolio-card__kpis">
                  <div className="grid-portfolio-card__kpi">
                    <span>预计最大亏损</span>
                    <span
                      className="font-mono tabular-nums"
                      style={{ color: 'var(--loss)' }}
                    >
                      {formatGridAmount(maxLoss)}
                    </span>
                  </div>
                  <div className="grid-portfolio-card__kpi">
                    <span>已投入金额</span>
                    <span className="font-mono tabular-nums">
                      {formatGridAmount(st.occupied)}
                    </span>
                  </div>
                  <div className="grid-portfolio-card__kpi">
                    <span>已实现收益</span>
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
                      {formatSignedGridAmount(st.realized)}
                    </span>
                  </div>
                </div>
                <Space className="grid-portfolio-card__actions">
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
          )
        )}
      </div>
    </Space>
  );
}
