'use client';

import {
  formatGridAmount,
  formatGridPrice,
  formatSignedGridAmount,
} from '@/lib/grid/format-grid-amount';
import { computeSellRealizedPnl } from '@/lib/grid/grid-strategy-trade-stats';
import { describeError } from '@/lib/describe-error';
import type { GridStrategyTrade } from '@/types/grid-strategy-trade';
import type { SavedGridStrategyV1 } from '@/types/grid-strategy-storage';
import { Alert, App, Button, Empty, Select, Space, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useMemo, useState } from 'react';

export interface GridTradeJournalProps {
  strategies: SavedGridStrategyV1[];
  trades: GridStrategyTrade[];
  strategyId: string | 'all';
  onStrategyChange: (strategyId: string | 'all') => void;
  onDelete?: (id: string) => Promise<void>;
  /** 流水读取失败（保留上次数据展示）；null 表示无错误 */
  loadError?: string | null;
  onRetry?: () => void;
  /** 正在（重新）读取流水，用于重试按钮的加载态 */
  loading?: boolean;
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
  priceUnit: number;
  qty: number;
  amount: number;
  pnl: number | null;
}

/**
 * 与仓库同一排序规则（createdAt + id）计算每档"最后录入的一笔"：
 * 只有这些行展示删除入口，用户不必点了确认才知道删不掉。
 */
function computeDeletableIds(trades: GridStrategyTrade[]): Set<string> {
  const lastByLevel = new Map<string, GridStrategyTrade>();
  for (const t of trades) {
    const key = `${t.strategyId}\u0000${t.levelKey}`;
    const prev = lastByLevel.get(key);
    if (
      !prev ||
      t.createdAt.localeCompare(prev.createdAt) > 0 ||
      (t.createdAt === prev.createdAt && t.id.localeCompare(prev.id) > 0)
    ) {
      lastByLevel.set(key, t);
    }
  }
  return new Set(Array.from(lastByLevel.values(), t => t.id));
}

/**
 * 成交流水表。
 */
export function GridTradeJournal({
  strategies,
  trades,
  strategyId,
  onStrategyChange,
  onDelete,
  loadError,
  onRetry,
  loading,
}: GridTradeJournalProps) {
  const { modal, message } = App.useApp();
  const [sideFilter, setSideFilter] = useState<'all' | 'buy' | 'sell'>('all');

  const strategyMap = useMemo(() => {
    const map = new Map(strategies.map(s => [s.id, s]));
    return map;
  }, [strategies]);

  const deletableIds = useMemo(() => computeDeletableIds(trades), [trades]);

  const rows = useMemo((): JournalRow[] => {
    let list = [...trades];
    if (strategyId !== 'all') {
      list = list.filter(t => t.strategyId === strategyId);
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
        /* 策略已被删除时兜底为可读文案，不暴露异常占位符 */
        strategyName: s?.name ?? '未命名策略',
        symbol: s?.symbol ?? '',
        side: t.side,
        level: leg ? leg.positionRatio.toFixed(2) : '-',
        price: t.price,
        priceUnit: s?.config.params.priceUnit ?? 0.001,
        qty: t.qty,
        amount: t.price * t.qty,
        pnl: computeSellRealizedPnl(allForStrategy, t),
      };
    });
  }, [trades, strategyId, sideFilter, strategyMap]);

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
      render: (_: unknown, r: JournalRow) => (
        <span className="font-mono tabular-nums">
          {formatGridPrice(r.price, r.priceUnit)}
        </span>
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
        <span className="font-mono tabular-nums">{formatGridAmount(v)}</span>
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
            {formatSignedGridAmount(v)}
          </span>
        ),
    },
    ...(onDelete
      ? [
          {
            title: '操作',
            key: 'actions',
            width: 80,
            render: (_: unknown, r: JournalRow) =>
              deletableIds.has(r.id) ? (
                <Button
                  type="link"
                  danger
                  size="small"
                  onClick={() => {
                    modal.confirm({
                      title: `删除 ${r.date} 的${r.side === 'buy' ? '买入' : '卖出'}流水？`,
                      content: '删除后将重新计算该档持仓与已实现盈亏。',
                      okText: '删除',
                      okButtonProps: { danger: true },
                      cancelText: '取消',
                      onOk: async () => {
                        try {
                          await onDelete(r.id);
                          message.success('已删除该笔流水');
                        } catch (e) {
                          message.error(describeError(e, '删除失败，请重试'));
                          throw e; // 保留确认框，便于直接重试
                        }
                      },
                    });
                  }}
                >
                  删除
                </Button>
              ) : null,
          } satisfies ColumnsType<JournalRow>[number],
        ]
      : []),
  ];

  const hasFilter = strategyId !== 'all' || sideFilter !== 'all';

  return (
    <Space direction="vertical" size={12} className="w-full">
      {loadError ? (
        <Alert
          type="error"
          showIcon
          message={
            rows.length > 0 ? '流水刷新失败，当前显示上次结果' : '流水加载失败'
          }
          description={describeError(loadError, '网络或服务暂时不可用，请稍后重试')}
          action={
            onRetry ? (
              <Button size="small" loading={loading} onClick={() => void onRetry()}>
                重试
              </Button>
            ) : undefined
          }
        />
      ) : null}
      <Space wrap>
        <Select
          value={strategyId}
          onChange={onStrategyChange}
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
        {onDelete ? (
          <span className="text-xs text-[var(--muted-foreground)]">
            每档仅可删除最后录入的一笔
          </span>
        ) : null}
      </Space>
      {rows.length === 0 ? (
        /* 读失败不算"无流水"：错误横幅已交代失败与重试，空态文案反而误导 */
        loadError ? null : hasFilter ? (
          <Empty description="当前筛选没有流水">
            <Button
              shape="round"
              onClick={() => {
                onStrategyChange('all');
                setSideFilter('all');
              }}
            >
              清除筛选
            </Button>
          </Empty>
        ) : (
          <Empty description="还没有成交流水。保存策略后，可在档位表中记录每一笔买入与卖出。" />
        )
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
