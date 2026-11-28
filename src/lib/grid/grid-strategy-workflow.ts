import type { GridStrategyConfigV1 } from '@/types/grid-strategy-storage';
import { isSameGridStrategyConfig } from '@/lib/grid/grid-strategy-storage';

/** 保存主按钮展示状态 */
export interface GridStrategySaveState {
  label: '保存策略' | '更新策略' | '已保存';
  disabled: boolean;
  reason: string | null;
}

export interface GridStrategySaveStateInput {
  hasResult: boolean;
  hasCloudId: boolean;
  draftDirty: boolean;
  generatedDirty: boolean;
}

/**
 * 根据草稿/云端/待保存状态推导主按钮文案与可用性。
 */
export function getGridStrategySaveState(
  input: GridStrategySaveStateInput
): GridStrategySaveState {
  const { hasResult, hasCloudId, draftDirty, generatedDirty } = input;

  if (!hasResult) {
    return { label: '保存策略', disabled: true, reason: null };
  }

  if (draftDirty) {
    return {
      label: hasCloudId ? '更新策略' : '保存策略',
      disabled: true,
      reason: '请先重新生成，使参数与结果保持一致',
    };
  }

  if (!hasCloudId) {
    if (generatedDirty) {
      return { label: '保存策略', disabled: false, reason: null };
    }
    return { label: '保存策略', disabled: true, reason: null };
  }

  if (generatedDirty) {
    return { label: '更新策略', disabled: false, reason: null };
  }

  return { label: '已保存', disabled: true, reason: null };
}

/**
 * 切换策略前是否需要放弃确认。
 */
export function hasDiscardableGridChanges(input: {
  hasResult: boolean;
  hasCloudId: boolean;
  draftDirty: boolean;
  generatedDirty: boolean;
}): boolean {
  const { hasResult, hasCloudId, draftDirty, generatedDirty } = input;
  if (draftDirty) return true;
  if (!hasResult) return false;
  if (!hasCloudId && generatedDirty) return true;
  if (hasCloudId && generatedDirty) return true;
  return false;
}

/**
 * 由当前草稿表单构造配置，并与"已生成配置"比较是否脏。
 * baseline 是从未生成（generated 为空）时的对照物（初始默认值或刚载入的策略配置），
 * 保护首次生成前的参数编辑：没有它，新建/打开会静默丢掉用户已填的参数。
 */
export function isDraftConfigDirty(
  draft: GridStrategyConfigV1,
  generated: GridStrategyConfigV1 | null,
  baseline?: GridStrategyConfigV1 | null
): boolean {
  const reference = generated ?? baseline ?? null;
  if (!reference) return false;
  return !isSameGridStrategyConfig(draft, reference);
}
