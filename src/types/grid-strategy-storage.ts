import type { GridParams } from '@/types/grid';
import type { GridRunResult } from '@/lib/grid-run-calculation';

/** 当前持久化 schema 版本（与 DB CHECK 对齐） */
export const GRID_STRATEGY_SCHEMA_VERSION = 1 as const;

/** v1 可保存的计算配置（草稿/已生成共用结构） */
export interface GridStrategyConfigV1 {
  params: GridParams;
  dynamicGridEnabled: boolean;
  dynamicGridMode: 'stable' | 'aggressive';
}

/** v1 结果快照：运行时须为成功计算结果 */
export type GridStrategySnapshotV1 = GridRunResult;

/** 列表用元数据（不含 JSONB 大字段） */
export interface GridStrategyMetadata {
  id: string;
  name: string;
  /** 标的代码，可空 */
  symbol: string;
  schemaVersion: typeof GRID_STRATEGY_SCHEMA_VERSION;
  createdAt: string;
  updatedAt: string;
}

/** 完整已保存策略（详情） */
export interface SavedGridStrategyV1 extends GridStrategyMetadata {
  config: GridStrategyConfigV1;
  resultSnapshot: GridStrategySnapshotV1;
}

/** 创建/覆盖写入载荷 */
export interface GridStrategySavePayload {
  config: GridStrategyConfigV1;
  resultSnapshot: GridStrategySnapshotV1;
  /** 创建时可带标的代码；覆盖更新时若传入则一并写入 */
  symbol?: string;
}
