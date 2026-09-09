'use client';

import { GridSaveStatusIsland } from '@/components/grid/grid-save-status-island';
import { Button } from 'antd';

interface GridParamsSummaryBarProps {
  basePrice: number;
  minPrice: number;
  amountPerGrid: number;
  gridCount: number;
  priceDecimals: number;
  /** 已加载的云端策略名；本地未保存结果为 null */
  strategyName: string | null;
  /** 草稿相对已生成结果是否已改 */
  draftDirty: boolean;
  onEdit: () => void;
  saveLabel: '保存策略' | '更新策略' | '已保存';
  saveDisabled: boolean;
  saveLoading: boolean;
  saveReason: string | null;
  onSave: () => void;
}

/**
 * 结果态顶部参数摘要条（sticky）+ 策略身份 + 脏态引导 + 保存状态岛。
 */
export function GridParamsSummaryBar({
  basePrice,
  minPrice,
  amountPerGrid,
  gridCount,
  priceDecimals,
  strategyName,
  draftDirty,
  onEdit,
  saveLabel,
  saveDisabled,
  saveLoading,
  saveReason,
  onSave,
}: GridParamsSummaryBarProps) {
  const editLabel = draftDirty ? '去重新生成' : '修改参数';

  return (
    <div
      className={`grid-summary-bar${
        draftDirty ? ' grid-summary-bar--dirty' : ''
      }`}
    >
      <div className="grid-summary-bar__identity">
        {strategyName ? (
          <div className="grid-summary-bar__strategy">
            <span className="grid-summary-bar__strategy-label">当前策略</span>
            <span className="grid-summary-bar__strategy-name">
              {strategyName}
            </span>
          </div>
        ) : (
          <div className="grid-summary-bar__strategy grid-summary-bar__strategy--local">
            <span className="grid-summary-bar__strategy-label">当前结果</span>
            <span className="grid-summary-bar__strategy-name">未保存</span>
          </div>
        )}
        {draftDirty ? (
          <p className="grid-summary-bar__dirty-hint" role="status">
            参数已改，下方结果仍是旧快照。请重新生成后再保存。
          </p>
        ) : null}
      </div>
      <div className="grid-summary-bar__row">
        <div className="grid-summary-bar__meta">
          <span>
            基准价 <strong>{basePrice.toFixed(priceDecimals)}</strong>
          </span>
          <span>
            最低价 <strong>{minPrice.toFixed(priceDecimals)}</strong>
          </span>
          <span>
            单格金额{' '}
            <strong>{Math.round(amountPerGrid).toLocaleString()}</strong>
          </span>
          <span>
            档位 <strong>{gridCount}</strong>
          </span>
        </div>
        <div className="grid-summary-bar__actions">
          {draftDirty ? (
            <span className="grid-summary-bar__dirty-chip">参数已改</span>
          ) : null}
          <GridSaveStatusIsland
            label={saveLabel}
            disabled={saveDisabled}
            loading={saveLoading}
            reason={saveReason}
            onSave={onSave}
          />
          <Button
            type={draftDirty ? 'primary' : 'default'}
            shape="round"
            className={draftDirty ? 'grid-summary-bar__regen' : undefined}
            onClick={onEdit}
          >
            {editLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
