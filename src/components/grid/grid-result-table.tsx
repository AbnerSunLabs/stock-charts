'use client';

import { HelpTooltip } from '@/components/shared/help-tooltip';
import {
  buildFirstPositionByType,
  buildLegGridRowMap,
  getDisplayDropRate,
  GRID_TYPE_META,
} from '@/components/grid/grid-table-row-helpers';
import { exportGridTablePng } from '@/lib/grid/export-grid-table-png';
import type { GridRow } from '@/types/grid';
import type { AggregatedGridRow, GridLeg } from '@/types/grid-v2';
import { Button, message, Space, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Download } from 'lucide-react';
import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from 'react';
import { flushSync } from 'react-dom';

export interface GridResultTradeActions {
  strategyId: string | null;
  getLevelQty: (levelKey: string) => { openQty: number; rounds: number };
  onTrade: (side: 'buy' | 'sell', levelKey: string) => void;
}

interface GridResultTableProps {
  aggregatedRows: AggregatedGridRow[];
  legs: GridLeg[];
  basePrice: number;
  priceDecimals: number;
  tradeActions?: GridResultTradeActions;
}

type GroupTableRow = {
  kind: 'group';
  key: string;
  sortPrice: number;
  aggregated: AggregatedGridRow;
  childLegIds: string[];
};

type DetailTableRow = {
  kind: 'detail';
  key: string;
  sortPrice: number;
  row: GridRow;
  childLegIds: string[];
};

type ResultTableRow = GroupTableRow | DetailTableRow;

const DETAIL_CELL_CLS =
  'p-2 sm:p-4 text-sm text-[var(--foreground)] whitespace-nowrap';

/** 与 Ant Design 展开列宽度对齐 */
const EXPAND_COL_WIDTH = 48;
const EXEC_COL_WIDTH = 200;

function TypeBadge({ gridType }: { gridType: GridRow['gridType'] }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide ${GRID_TYPE_META[gridType]}`}
    >
      {gridType}
    </span>
  );
}

function DropRateCell({
  row,
  firstPositionByType,
}: {
  row: GridRow;
  firstPositionByType: Map<string, number>;
}) {
  const displayDropRate = getDisplayDropRate(row, firstPositionByType);
  return (
    <span
      className="text-sm font-medium"
      style={{
        color: displayDropRate < 0 ? 'var(--loss)' : 'var(--foreground)',
      }}
    >
      {displayDropRate === 0 ? '—' : `${displayDropRate.toFixed(2)}%`}
    </span>
  );
}

function ExecuteTradeCell({
  levelKey,
  tradeActions,
}: {
  levelKey: string;
  tradeActions: GridResultTradeActions;
}) {
  const { openQty, rounds } = tradeActions.getLevelQty(levelKey);

  if (openQty > 0) {
    return (
      <Space size="small" wrap>
        <Tag color="processing">持仓中</Tag>
        <Button
          size="small"
          onClick={() => tradeActions.onTrade('sell', levelKey)}
        >
          卖出
        </Button>
        {rounds > 0 ? (
          <span className="text-xs text-[var(--muted-foreground)]">
            已完成 {rounds} 轮
          </span>
        ) : null}
      </Space>
    );
  }

  return (
    <Button
      size="small"
      onClick={() => tradeActions.onTrade('buy', levelKey)}
    >
      买入
    </Button>
  );
}

function renderExecuteCell(
  record: ResultTableRow,
  tradeActions?: GridResultTradeActions
) {
  if (record.kind === 'group') {
    return (
      <span className="text-[var(--muted-foreground)]">展开后记账</span>
    );
  }
  if (!tradeActions?.strategyId) {
    return (
      <span className="text-[var(--muted-foreground)]">保存后可记账</span>
    );
  }
  const levelKey = record.childLegIds[0];
  return (
    <ExecuteTradeCell levelKey={levelKey} tradeActions={tradeActions} />
  );
}

function renderExpandedExecuteCell(
  legId: string,
  tradeActions?: GridResultTradeActions
) {
  if (!tradeActions?.strategyId) {
    return (
      <span className="text-[var(--muted-foreground)]">保存后可记账</span>
    );
  }
  return <ExecuteTradeCell levelKey={legId} tradeActions={tradeActions} />;
}

function DetailRowCells({
  row,
  firstPositionByType,
  priceDecimals,
}: {
  row: GridRow;
  firstPositionByType: Map<string, number>;
  priceDecimals: number;
}) {
  return (
    <>
      <td className={DETAIL_CELL_CLS}>
        <TypeBadge gridType={row.gridType} />
      </td>
      <td className={DETAIL_CELL_CLS}>{row.position.toFixed(2)}</td>
      <td className={DETAIL_CELL_CLS}>{row.buyPrice.toFixed(priceDecimals)}</td>
      <td className={DETAIL_CELL_CLS}>
        <DropRateCell row={row} firstPositionByType={firstPositionByType} />
      </td>
      <td className={DETAIL_CELL_CLS}>{row.buyAmount.toLocaleString()}</td>
      <td className={DETAIL_CELL_CLS}>{row.buyShares.toLocaleString()}</td>
      <td className={DETAIL_CELL_CLS}>{row.sellPrice.toFixed(priceDecimals)}</td>
      <td className={DETAIL_CELL_CLS}>{row.sellShares.toLocaleString()}</td>
      <td className={DETAIL_CELL_CLS}>{row.sellAmount.toLocaleString()}</td>
    </>
  );
}

function ExpandedLegRows({
  legIds,
  legRowMap,
  firstPositionByType,
  priceDecimals,
  tradeActions,
}: {
  legIds: string[];
  legRowMap: Map<string, GridRow>;
  firstPositionByType: Map<string, number>;
  priceDecimals: number;
  tradeActions?: GridResultTradeActions;
}) {
  const hasExecCol = tradeActions !== undefined;

  return (
    <table className="grid-result-expanded-table w-full border-collapse">
      <colgroup>
        <col style={{ width: EXPAND_COL_WIDTH }} />
        <col />
        <col />
        <col />
        <col />
        <col />
        <col />
        <col />
        <col />
        <col />
        {hasExecCol ? <col style={{ width: EXEC_COL_WIDTH }} /> : null}
      </colgroup>
      <tbody>
        {legIds.map(legId => {
          const row = legRowMap.get(legId);
          if (!row) return null;

          return (
            <tr
              key={legId}
              className="grid-result-detail-row border-b border-[var(--border)] transition-colors last:border-b-0 hover:bg-[var(--hover-bg)]"
            >
              <td className="grid-result-expand-spacer" aria-hidden />
              <DetailRowCells
                row={row}
                firstPositionByType={firstPositionByType}
                priceDecimals={priceDecimals}
              />
              {hasExecCol ? (
                <td className={DETAIL_CELL_CLS}>
                  {renderExpandedExecuteCell(legId, tradeActions)}
                </td>
              ) : null}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

interface GridResultTableViewProps {
  tableRows: ResultTableRow[];
  columns: ColumnsType<ResultTableRow>;
  expandedRowKeys: string[];
  onExpandedRowsChange?: (keys: string[]) => void;
  legRowMap: Map<string, GridRow>;
  firstPositionByType: Map<string, number>;
  priceDecimals: number;
  tradeActions?: GridResultTradeActions;
  containerRef?: RefObject<HTMLDivElement>;
  containerClassName?: string;
  containerStyle?: CSSProperties;
  ariaHidden?: boolean;
}

function GridResultTableView({
  tableRows,
  columns,
  expandedRowKeys,
  onExpandedRowsChange,
  legRowMap,
  firstPositionByType,
  priceDecimals,
  tradeActions,
  containerRef,
  containerClassName = '',
  containerStyle,
  ariaHidden = false,
}: GridResultTableViewProps) {
  return (
    <div
      ref={containerRef}
      style={containerStyle}
      aria-hidden={ariaHidden || undefined}
      className={`overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-[var(--ds-shadow-sm)] [-webkit-overflow-scrolling:touch] ${containerClassName}`}
      aria-label="网格结果表，可横向滚动"
    >
      <Table<ResultTableRow>
        columns={columns}
        dataSource={tableRows}
        rowKey="key"
        pagination={false}
        tableLayout="fixed"
        className="grid-result-table min-w-[800px]"
        expandable={{
          expandedRowKeys,
          onExpandedRowsChange: onExpandedRowsChange
            ? keys => onExpandedRowsChange(keys.map(String))
            : undefined,
          expandedRowClassName: () => 'grid-result-expanded-row',
          expandedRowRender: record =>
            record.kind === 'group' ? (
              <ExpandedLegRows
                legIds={record.childLegIds}
                legRowMap={legRowMap}
                firstPositionByType={firstPositionByType}
                priceDecimals={priceDecimals}
                tradeActions={tradeActions}
              />
            ) : null,
          rowExpandable: record =>
            record.kind === 'group' && record.childLegIds.length > 1,
        }}
      />
    </div>
  );
}

export function GridResultTable({
  aggregatedRows,
  legs,
  basePrice,
  priceDecimals,
  tradeActions,
}: GridResultTableProps) {
  const visibleTableRef = useRef<HTMLDivElement>(null);
  const exportCaptureRef = useRef<HTMLDivElement>(null);
  const [expandedRowKeys, setExpandedRowKeys] = useState<string[]>([]);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isExportSnapshotActive, setIsExportSnapshotActive] = useState(false);
  const [exportTableWidth, setExportTableWidth] = useState(0);
  const legRowMap = useMemo(
    () => buildLegGridRowMap(legs, basePrice),
    [legs, basePrice]
  );
  const firstPositionByType = useMemo(
    () => buildFirstPositionByType(legs),
    [legs]
  );

  const tableRows = useMemo((): ResultTableRow[] => {
    const sorted = [...aggregatedRows].sort(
      (a, b) => b.triggerBuyPrice - a.triggerBuyPrice
    );

    return sorted.map(agg => {
      if (agg.childLegIds.length === 1) {
        const legId = agg.childLegIds[0];
        const row = legRowMap.get(legId);
        return {
          kind: 'detail' as const,
          key: `detail-${legId}`,
          sortPrice: agg.triggerBuyPrice,
          row: row ?? {
            position: 0,
            buyTriggerPrice: 0,
            buyPrice: agg.displayBuyPrice,
            buyAmount: Math.round(agg.totalBuyAmount),
            buyShares: agg.totalBuyShares,
            sellTriggerPrice: 0,
            sellPrice: 0,
            sellShares: 0,
            sellAmount: 0,
            priceDropRate: 0,
            gridType: agg.gridTypes[0] ?? '小网',
          },
          childLegIds: agg.childLegIds,
        };
      }

      return {
        kind: 'group' as const,
        key: `group-${agg.clusterId}`,
        sortPrice: agg.triggerBuyPrice,
        aggregated: agg,
        childLegIds: agg.childLegIds,
      };
    });
  }, [aggregatedRows, legRowMap]);

  const exportGroupKeys = useMemo(
    () =>
      tableRows
        .filter(
          (row): row is GroupTableRow =>
            row.kind === 'group' && row.childLegIds.length > 1
        )
        .map(row => row.key),
    [tableRows]
  );

  const columns: ColumnsType<ResultTableRow> = useMemo(() => [
    {
      title: '类型',
      width: 168,
      render: (_: unknown, record: ResultTableRow) => {
        if (record.kind === 'group') {
          return (
            <span className="whitespace-nowrap font-medium text-[var(--foreground)]">
              {record.aggregated.displayType}
            </span>
          );
        }
        return <TypeBadge gridType={record.row.gridType} />;
      },
    },
    {
      title: '档位',
      width: 72,
      render: (_: unknown, record: ResultTableRow) =>
        record.kind === 'detail' ? record.row.position.toFixed(2) : '—',
    },
    {
      title: '买入价',
      width: 88,
      render: (_: unknown, record: ResultTableRow) => {
        if (record.kind === 'group') {
          return (
            <span
              title={`展示价 ${record.aggregated.displayBuyPrice.toFixed(priceDecimals)}`}
            >
              {record.aggregated.triggerBuyPrice.toFixed(priceDecimals)}
            </span>
          );
        }
        return record.row.buyPrice.toFixed(priceDecimals);
      },
    },
    {
      title: (
        <div className="flex items-center gap-1">
          <span>跌幅</span>
          <HelpTooltip
            title="相对于上一档位的跌幅"
            placement="bottomLeft"
            maxWidth="12rem"
          />
        </div>
      ),
      width: 88,
      render: (_: unknown, record: ResultTableRow) => {
        if (record.kind === 'group') return '—';
        return (
          <DropRateCell
            row={record.row}
            firstPositionByType={firstPositionByType}
          />
        );
      },
    },
    {
      title: '买入金额',
      width: 96,
      render: (_: unknown, record: ResultTableRow) => {
        const amount =
          record.kind === 'group'
            ? Math.round(record.aggregated.totalBuyAmount)
            : record.row.buyAmount;
        return amount.toLocaleString();
      },
    },
    {
      title: '买入股数',
      width: 96,
      render: (_: unknown, record: ResultTableRow) => {
        const shares =
          record.kind === 'group'
            ? record.aggregated.totalBuyShares
            : record.row.buyShares;
        return shares.toLocaleString();
      },
    },
    {
      title: '卖出价',
      width: 88,
      render: (_: unknown, record: ResultTableRow) =>
        record.kind === 'detail'
          ? record.row.sellPrice.toFixed(priceDecimals)
          : '—',
    },
    {
      title: '卖出股数',
      width: 96,
      render: (_: unknown, record: ResultTableRow) =>
        record.kind === 'detail'
          ? record.row.sellShares.toLocaleString()
          : '—',
    },
    {
      title: '卖出金额',
      width: 96,
      render: (_: unknown, record: ResultTableRow) =>
        record.kind === 'detail'
          ? record.row.sellAmount.toLocaleString()
          : '—',
    },
    {
      title: '执行',
      width: EXEC_COL_WIDTH,
      fixed: 'right',
      render: (_: unknown, record: ResultTableRow) =>
        renderExecuteCell(record, tradeActions),
    },
  ], [firstPositionByType, priceDecimals, tradeActions]);

  const handleDownloadPng = useCallback(async (): Promise<string> => {
    const visibleTableWidth = visibleTableRef.current?.scrollWidth;
    if (!visibleTableWidth) {
      throw new Error('导出表格未就绪');
    }

    flushSync(() => {
      setExportTableWidth(visibleTableWidth);
      setIsExportSnapshotActive(true);
    });

    try {
      await new Promise<void>(resolve => {
        window.setTimeout(resolve, 300);
      });

      const element = exportCaptureRef.current;
      if (!element) {
        throw new Error('导出表格未就绪');
      }

      return await exportGridTablePng(element);
    } finally {
      setIsExportSnapshotActive(false);
    }
  }, []);

  const handleDownloadClick = useCallback(async () => {
    setIsDownloading(true);
    try {
      const filename = await handleDownloadPng();
      message.success(`已下载 ${filename}`);
    } catch (error) {
      console.error('[grid-table-export]', error);
      message.error('下载失败，请重试');
    } finally {
      setIsDownloading(false);
    }
  }, [handleDownloadPng]);

  if (tableRows.length === 0) return null;

  return (
    <div className="mb-8">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-xs leading-relaxed text-[var(--muted-foreground)]">
          同价位小/中/大网已合并为聚合组；展开后可对各档记账
        </p>
        <button
          type="button"
          onClick={handleDownloadClick}
          disabled={isDownloading}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-xs font-medium text-[var(--foreground)] shadow-[var(--ds-shadow-sm)] transition-colors hover:bg-[var(--hover-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--card)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Download className="h-3.5 w-3.5" aria-hidden />
          下载表格
        </button>
      </div>

      <GridResultTableView
        tableRows={tableRows}
        columns={columns}
        expandedRowKeys={expandedRowKeys}
        onExpandedRowsChange={setExpandedRowKeys}
        legRowMap={legRowMap}
        firstPositionByType={firstPositionByType}
        priceDecimals={priceDecimals}
        tradeActions={tradeActions}
        containerRef={visibleTableRef}
      />

      {isExportSnapshotActive ? (
        <GridResultTableView
          tableRows={tableRows}
          columns={columns}
          expandedRowKeys={exportGroupKeys}
          legRowMap={legRowMap}
          firstPositionByType={firstPositionByType}
          priceDecimals={priceDecimals}
          tradeActions={tradeActions}
          containerRef={exportCaptureRef}
          containerClassName="pointer-events-none fixed left-[-10000px] top-0 z-[-1] overflow-visible shadow-none"
          containerStyle={{ width: exportTableWidth }}
          ariaHidden
        />
      ) : null}
    </div>
  );
}
