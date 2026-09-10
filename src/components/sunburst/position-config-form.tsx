'use client';

import { Collapse, Input, InputNumber, Space } from 'antd';
import { useMemo } from 'react';
import {
  buildPositionPathMap,
  formatYuan,
  getUnallocatedAmount,
  roundAmount,
  sumAllocatedAmount,
  type PositionNodeResult,
} from '@/utils/calculate-position-tree';
import {
  collectAllPaths,
  POSITION_CATEGORY_TREE,
  POSITION_META,
  type CategoryNode,
} from '@/utils/position-category-tree';

/** 千分位展示；空值不格式化为 "0" 或 "undefined" */
function formatAmountDisplay(value: number | string | undefined | null): string {
  if (value === undefined || value === null || value === '') return '';
  const num = Number(value);
  if (Number.isNaN(num)) return '';
  const [intPart, decPart] = num.toFixed(2).split('.');
  const intFormatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  if (decPart === '00') return intFormatted;
  return `${intFormatted}.${decPart}`;
}

/** 解析输入为数字，空字符串返回 NaN 以便 InputNumber 进入编辑态 */
function parseAmountDisplay(value: string | undefined): number {
  const cleaned = (value ?? '').replace(/,/g, '').trim();
  if (cleaned === '') return Number.NaN;
  return Number(cleaned);
}

const AMOUNT_INPUT_CLASS = 'sunburst-amount-input w-full min-w-0';

interface PositionConfigFormProps {
  totalInvestment: number | null;
  onTotalInvestmentChange: (value: number | null) => void;
  leafAmounts: Record<string, number>;
  onLeafAmountChange: (path: string, value: number | null) => void;
  calculatedNodes: PositionNodeResult[];
  warnings: string[];
}

/** 金额输入框（元，最多两位小数）；空值用 null，避免受控 0 导致无法继续输入 */
function YuanInput({
  value,
  onChange,
  placeholder,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  placeholder?: string;
}) {
  return (
    <Space.Compact className="w-full min-w-0 max-w-full sm:max-w-[240px]">
      <InputNumber
        min={0}
        precision={2}
        step={0.01}
        className={AMOUNT_INPUT_CLASS}
        placeholder={placeholder}
        controls
        value={value}
        formatter={formatAmountDisplay}
        parser={parseAmountDisplay}
        onChange={v => {
          if (v === null || v === undefined || Number.isNaN(Number(v))) {
            onChange(null);
            return;
          }
          onChange(roundAmount(Number(v)));
        }}
      />
      <Input
        readOnly
        tabIndex={-1}
        value="元"
        aria-hidden
        className="sunburst-amount-unit"
      />
    </Space.Compact>
  );
}

/** 节点汇总行：名称 + 金额 + 占比 */
function SummaryCells({
  name,
  amount,
  percentage,
  indent = 0,
}: {
  name: string;
  amount: number;
  percentage: string;
  indent?: number;
}) {
  return (
    <div
      className="flex flex-wrap items-center gap-x-4 gap-y-1 flex-1 min-w-0"
      style={{ paddingLeft: indent * 12 }}
    >
      <span className="font-medium text-[var(--text-primary)] min-w-[4em]">{name}</span>
      <span className="text-[0.8125rem] text-[var(--text-muted)] tabular-nums">
        {formatYuan(amount)} 元
      </span>
      <span className="text-[0.8125rem] font-semibold text-[var(--accent)] tabular-nums">
        {percentage}
      </span>
    </div>
  );
}

/** 叶子节点行 */
function LeafRow({
  path,
  name,
  amount,
  percentage,
  leafValue,
  onLeafAmountChange,
  indent,
}: {
  path: string;
  name: string;
  amount: number;
  percentage: string;
  leafValue: number | null;
  onLeafAmountChange: (path: string, value: number | null) => void;
  indent: number;
}) {
  return (
    <div
      className="flex flex-wrap items-center gap-3 py-2 border-b border-[var(--border-subtle)] last:border-b-0"
      style={{ paddingLeft: indent * 12 }}
    >
      <span className="font-medium text-[var(--text-primary)] min-w-[4em]">{name}</span>
      <YuanInput value={leafValue} onChange={v => onLeafAmountChange(path, v)} />
      <span className="text-[0.8125rem] text-[var(--text-muted)] tabular-nums">
        汇总 {formatYuan(amount)} 元
      </span>
      <span className="text-[0.8125rem] font-semibold text-[var(--accent)] tabular-nums">
        {percentage}
      </span>
    </div>
  );
}

/** 递归渲染分类分支 */
function CategoryBranch({
  node,
  parentPath,
  pathMap,
  leafAmounts,
  onLeafAmountChange,
  depth,
}: {
  node: CategoryNode;
  parentPath: string;
  pathMap: Map<string, PositionNodeResult>;
  leafAmounts: Record<string, number>;
  onLeafAmountChange: (path: string, value: number | null) => void;
  depth: number;
}) {
  const path = parentPath ? `${parentPath}/${node.name}` : node.name;
  const computed = pathMap.get(path);
  const amount = computed?.amount ?? 0;
  const percentage = computed?.percentage ?? '0.00%';
  const isLeaf = !node.children?.length;

  if (isLeaf) {
    return (
      <LeafRow
        path={path}
        name={node.name}
        amount={amount}
        percentage={percentage}
        leafValue={leafAmounts[path] ?? null}
        onLeafAmountChange={onLeafAmountChange}
        indent={depth}
      />
    );
  }

  return (
    <Collapse
      defaultActiveKey={[path]}
      bordered={false}
      className="sunburst-category-collapse bg-transparent [&_.ant-collapse-item]:border-[var(--border-subtle)]"
      items={[
        {
          key: path,
          label: (
            <SummaryCells
              name={node.name}
              amount={amount}
              percentage={percentage}
              indent={0}
            />
          ),
          children: (
            <div className="flex flex-col gap-0 pl-2">
              {node.children!.map(child => (
                <CategoryBranch
                  key={`${path}/${child.name}`}
                  node={child}
                  parentPath={path}
                  pathMap={pathMap}
                  leafAmounts={leafAmounts}
                  onLeafAmountChange={onLeafAmountChange}
                  depth={depth + 1}
                />
              ))}
            </div>
          ),
        },
      ]}
    />
  );
}

/**
 * 旭日图持仓配置表单：总投资额 + 可折叠树形金额录入 + 占比展示。
 */
export function PositionConfigForm({
  totalInvestment,
  onTotalInvestmentChange,
  leafAmounts,
  onLeafAmountChange,
  calculatedNodes,
  warnings,
}: PositionConfigFormProps) {
  const pathMap = useMemo(
    () => buildPositionPathMap(calculatedNodes),
    [calculatedNodes]
  );

  const allocated = useMemo(
    () => sumAllocatedAmount(calculatedNodes),
    [calculatedNodes]
  );

  const unallocated = useMemo(
    () => getUnallocatedAmount(totalInvestment ?? 0, calculatedNodes),
    [totalInvestment, calculatedNodes]
  );

  const allocatedPct = useMemo(() => {
    const total = totalInvestment ?? 0;
    if (total <= 0) return '0.00%';
    return `${((allocated / total) * 100).toFixed(2)}%`;
  }, [allocated, totalInvestment]);

  const defaultOpenKeys = useMemo(() => collectAllPaths(POSITION_CATEGORY_TREE), []);

  return (
    <section
      className="mb-6 py-4 px-4 sm:py-5 sm:px-6 bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl"
      aria-label="持仓配置"
    >
      <header className="mb-5 pr-12 sm:pr-0">
        <h1 className="font-[var(--font-display)] text-lg sm:text-[1.25rem] font-semibold text-[var(--text-primary)] m-0 mb-1">
          {POSITION_META.name}
        </h1>
      </header>

      <div className="flex flex-wrap items-end gap-4 mb-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-[0.8125rem] font-semibold text-[var(--text-secondary)]">
            总投资额
          </label>
          <YuanInput
            value={totalInvestment}
            onChange={onTotalInvestmentChange}
            placeholder="请输入总投资额"
          />
        </div>
        <div className="text-[0.8125rem] text-[var(--text-muted)] tabular-nums">
          已分配：{formatYuan(allocated)} 元（{allocatedPct}）
          <span className="mx-2">·</span>
          未分配：{formatYuan(unallocated)} 元
        </div>
      </div>

      {warnings.length > 0 && (
        <div className="mb-4" role="alert">
          {warnings.map(w => (
            <p key={w} className="m-0 text-[0.8125rem] text-amber-600">
              {w}
            </p>
          ))}
        </div>
      )}

      <div className="pt-4 border-t border-[var(--border-subtle)]">
        <p className="m-0 mb-3 text-[0.8125rem] font-semibold text-[var(--text-secondary)]">
          持仓配置（点击分支可折叠）
        </p>
        <Collapse
          defaultActiveKey={defaultOpenKeys}
          bordered={false}
          className="sunburst-root-collapse bg-transparent"
          items={POSITION_CATEGORY_TREE.map(node => {
            const path = node.name;
            const computed = pathMap.get(path);
            return {
              key: path,
              label: (
                <SummaryCells
                  name={node.name}
                  amount={computed?.amount ?? 0}
                  percentage={computed?.percentage ?? '0.00%'}
                />
              ),
              children: (
                <div className="flex flex-col gap-0 pl-2">
                  {node.children?.map(child => (
                    <CategoryBranch
                      key={`${path}/${child.name}`}
                      node={child}
                      parentPath={path}
                      pathMap={pathMap}
                      leafAmounts={leafAmounts}
                      onLeafAmountChange={onLeafAmountChange}
                      depth={1}
                    />
                  ))}
                </div>
              ),
            };
          })}
        />
      </div>
    </section>
  );
}
