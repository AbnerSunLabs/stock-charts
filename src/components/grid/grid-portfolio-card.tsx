'use client';

import { EditOutlined } from '@ant-design/icons';
import { Button, Card, Space, Tag } from 'antd';
import { useRef, useState } from 'react';

import { DsTooltip } from '@/components/shared/help-tooltip';
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
  computeLatestProfit,
  computeStrategyTradeStats,
  estimateMaxLossFromSnapshot,
} from '@/lib/grid/grid-strategy-trade-stats';
import type { EtfLatestClose } from '@/lib/supabase/etf-daily-repository';
import type { GridStrategyTrade } from '@/types/grid-strategy-trade';
import type { SavedGridStrategyV1 } from '@/types/grid-strategy-storage';

export interface PortfolioCardView {
  s: SavedGridStrategyV1;
  st: ReturnType<typeof computeStrategyTradeStats>;
  maxCapital: number;
  maxLoss: number;
  closeLabel: string;
  closeText: string;
  buyView: BoardDistanceView;
  sellView: BoardDistanceView;
  latestProfit: number;
}

/** 看板卡片上的数字，点位页复用同一份。 */
export function toPortfolioCardView(
  strategy: SavedGridStrategyV1,
  trades: GridStrategyTrade[],
  quote: EtfLatestClose | undefined
): PortfolioCardView {
  const levelKeys = strategy.resultSnapshot.legs.map(leg => leg.id);
  const strategyTrades = trades.filter(trade => trade.strategyId === strategy.id);
  const st = computeStrategyTradeStats(strategyTrades, levelKeys);
  const stress = strategy.resultSnapshot.stressTest;
  const priceUnit = strategy.config.params.priceUnit;
  const close = quote?.close ?? null;
  const levels = buildBoardQuoteLevels(strategy.resultSnapshot.legs, strategyTrades);
  const buyAnchor = close == null ? null : pickNearestUnboughtBuyPrice(close, levels);
  const sellAnchor = close == null ? null : pickLatestAwaitingSellPrice(levels, strategyTrades);
  return {
    s: strategy,
    st,
    maxCapital: stress?.v2?.totalBudgetRequired ?? stress?.totalBuyAmount ?? 0,
    maxLoss: estimateMaxLossFromSnapshot(stress, strategy.config.params.minPrice),
    closeLabel: quote ? `收盘 ${formatCloseMonthDay(quote.tradeDate)}` : '收盘',
    closeText: close == null ? '—' : formatGridPrice(close, priceUnit),
    buyView: describeBoardDistance(close, buyAnchor, priceUnit),
    sellView: describeBoardDistance(close, sellAnchor, priceUnit),
    latestProfit: computeLatestProfit(st, close),
  };
}

/**
 * 组合看板里的单张策略卡。点位跟踪页嵌同一张，样式不另做。
 */
export function GridPortfolioCard({
  view,
  onOpenCalculator,
  onOpenJournal,
  onEdit,
}: {
  view: PortfolioCardView;
  onOpenCalculator: (strategyId: string) => void;
  onOpenJournal: (strategyId: string) => void;
  onEdit?: (strategy: SavedGridStrategyV1) => void;
}) {
  const { s, st, maxLoss, closeLabel, closeText, buyView, sellView, latestProfit } = view;
  return (
    <Card
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
        <div className="grid-portfolio-card__note">{s.note ? <NoteTag note={s.note} /> : null}</div>
        <div className="grid-portfolio-card__quotes">
          <MarketCell label={closeLabel} closeText={closeText} />
          <MarketCell label="下一买" view={buyView} />
          <MarketCell label="下一卖" view={sellView} />
        </div>
        <div className="grid-portfolio-card__kpis">
          <div className="grid-portfolio-card__kpi">
            <span>预计最大亏损</span>
            <span className="font-mono tabular-nums" style={{ color: 'var(--loss)' }}>
              {formatGridAmount(maxLoss)}
            </span>
          </div>
          <div className="grid-portfolio-card__kpi">
            <span>已投入金额</span>
            <span className="font-mono tabular-nums">{formatGridAmount(st.occupied)}</span>
          </div>
          <div className="grid-portfolio-card__kpi">
            <span>已实现收益</span>
            <span
              className="font-mono tabular-nums"
              style={{
                color: latestProfit > 0 ? 'var(--profit)' : latestProfit < 0 ? 'var(--loss)' : undefined,
              }}
            >
              {formatSignedGridAmount(latestProfit)}
            </span>
          </div>
        </div>
        <Space className="grid-portfolio-card__actions">
          <Button type="primary" shape="round" onClick={() => onOpenCalculator(s.id)}>
            打开计算器
          </Button>
          <Button shape="round" onClick={() => onOpenJournal(s.id)}>
            流水
          </Button>
        </Space>
      </Space>
    </Card>
  );
}

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
      {sub ? <div className="grid-portfolio-card__quote-sub">{sub}</div> : null}
    </div>
  );
}

function NoteTag({ note }: { note: string }) {
  const wrapRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const onOpenChange = (next: boolean) => {
    if (!next) {
      setOpen(false);
      return;
    }
    const tag = wrapRef.current?.querySelector('.ant-tag');
    setOpen(tag instanceof HTMLElement && tag.scrollWidth > tag.clientWidth);
  };
  return (
    <DsTooltip title={note} placement="topLeft" maxWidth="20rem" wrapBody open={open} onOpenChange={onOpenChange}>
      <span ref={wrapRef} className="grid-portfolio-card__note-text">
        <Tag color="blue" className="m-0">
          {note}
        </Tag>
      </span>
    </DsTooltip>
  );
}
