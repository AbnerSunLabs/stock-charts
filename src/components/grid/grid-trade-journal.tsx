'use client';

import { computeSellRealizedPnl } from '@/lib/grid/grid-strategy-trade-stats';
import type { GridStrategyTrade } from '@/types/grid-strategy-trade';
import type { SavedGridStrategyV1 } from '@/types/grid-strategy-storage';
import { Button, Empty, Select, Space, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useEffect, useMemo, useState } from 'react';

export interface GridTradeJournalProps {
  strategies: SavedGridStrategyV1[];
  trades: GridStrategyTrade[];
  initialStrategyId?: string | 'all';
  onDelete?: (id: string) => Promise<void>;
}

interface JournalRow {
  key: string;
  id: string;
  date: string;
  strategyName: string;
  symbol: string;
  side: 'buy' | 'sell';
  level: string;
  price: number;
  qty: number;
  amount: number;
  pnl: number | null;
}

function money(n: number): string {
  return n.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * 成交流水表。
 */
export function GridTradeJournal({
  strategies,
  trades,
  initialStrategyId = 'all',
  onDelete,
}: GridTradeJournalProps) {
  const [strategyFilter, setStrategyFilter] = useState<string>(
    initialStrategyId
  );
  const [sideFilter, setSideFilter] = useState<'all' | 'buy' | 'sell'>('all');

  useEffect(() => {
    setStrategyFilter(initialStrategyId);
  }, [initialStrategyId]);

  const strategyMap = useMemo(() => {
    const map = new Map(strategies.map(s => [s.id, s]));
    return map;
  }, [strategies]);

  const rows = useMemo((): JournalRow[] => {
    let list = [...trades];
    if (strategyFilter !== 'all') {
      list = list.filter(t => t.strategyId === strategyFilter);
    }
    if (sideFilter !== 'all') {
      list = list.filter(t => t.side === sideFilter);
    }
    list.sort(
      (a, b) =>
        b.tradeDate.localeCompare(a.tradeDate) ||
        b.createdAt.localeCompare(a.createdAt)
    );

    return list.map(t => {
      const s = strategyMap.get(t.strategyId);
      const leg = s?.resultSnapshot.legs.find(l => l.id === t.levelKey);
      const allForStrategy = trades.filter(x => x.strategyId === t.strategyId);
      return {
        key: t.id,
        id: t.id,
        date: t.tradeDate,
        strategyName: s?.name ?? '?',
        symbol: s?.symbol ?? '',
        side: t.side,
        level: leg ? leg.positionRatio.toFixed(2) : '-',
        price: t.price,
        qty: t.qty,
        amount: t.price * t.qty,
        pnl: computeSellRealizedPnl(allForStrategy, t),
      };
    });
  }, [trades, strategyFilter, sideFilter, strategyMap]);

  const columns: ColumnsType<JournalRow> = [
    { title: '日期', dataIndex: 'date', width: 110 },
    {
      title: '策略',
      key: 'strategy',
      width: 160,
      render: (_, r) => (
        <span>
          {r.strategyName}
          {r.symbol ? (
            <span className="ml-1 text-xs text-[var(--muted-foreground)]">
              {r.symbol}
            </span>
          ) : null}
        </span>
      ),
    },
    {
      title: '方向',
      dataIndex: 'side',
      width: 80,
      render: (side: 'buy' | 'sell') =>
        side === 'buy' ? (
          <Tag color="processing">买入</Tag>
        ) : (
          <Tag color="success">卖出</Tag>
        ),
    },
    { title: '档位', dataIndex: 'level', width: 80 },
    {
      title: '成交价',
      dataIndex: 'price',
      width: 100,
      render: (v: number) => (
        <span className="font-mono tabular-nums">{money(v)}</span>
      ),
    },
    {
      title: '股数',
      dataIndex: 'qty',
      width: 90,
      render: (v: number) => (
        <span className="font-mono tabular-nums">
          {v.toLocaleString('zh-CN')}
        </span>
      ),
    },
    {
      title: '金额',
      dataIndex: 'amount',
      width: 110,
      render: (v: number) => (
        <span className="font-mono tabular-nums">{money(v)}</span>
      ),
    },
    {
      title: '盈利金额',
      dataIndex: 'pnl',
      width: 110,
      render: (v: number | null) =>
        v == null ? (
          '-'
        ) : (
          <span
            className="font-mono tabular-nums"
            style={{
              color:
                v > 0 ? 'var(--profit)' : v < 0 ? 'var(--loss)' : undefined,
            }}
          >
            {v >= 0 ? '+' : ''}
            {money(v)}
          </span>
        ),
    },
    ...(onDelete
      ? [
          {
            title: '操作',
            key: 'actions',
            width: 80,
            render: (_: unknown, r: JournalRow) => (
              <Button
                type="link"
                danger
                size="small"
                onClick={() => void onDelete(r.id)}
              >
                删除
              </Button>
            ),
          } satisfies ColumnsType<JournalRow>[number],
        ]
      : []),
  ];

  return (
    <Space direction="vertical" size={12} className="w-full">
      <Space wrap>
        <Select
          value={strategyFilter}
          onChange={setStrategyFilter}
          style={{ minWidth: 180 }}
          options={[
            { value: 'all', label: '全部策略' },
            ...strategies.map(s => ({
              value: s.id,
              label: s.symbol ? `${s.name} ${s.symbol}` : s.name,
            })),
          ]}
        />
        <Select
          value={sideFilter}
          onChange={setSideFilter}
          style={{ width: 120 }}
          options={[
            { value: 'all', label: '全部方向' },
            { value: 'buy', label: '买入' },
            { value: 'sell', label: '卖出' },
          ]}
        />
      </Space>
      {rows.length === 0 ? (
        <Empty description="暂无流水。保存策略后在结果表点买入/卖出；同档可反复。" />
      ) : (
        <Table
          size="middle"
          rowKey="key"
          columns={columns}
          dataSource={rows}
          pagination={{ pageSize: 20 }}
          scroll={{ x: 900 }}
        />
      )}
    </Space>
  );
}
