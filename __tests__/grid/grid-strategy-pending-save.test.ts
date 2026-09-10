/**
 * @jest-environment jsdom
 */
import { runGridCalculation } from '@/lib/grid-run-calculation';
import {
  PENDING_GRID_STRATEGY_LIBRARY_KEY,
  PENDING_GRID_STRATEGY_SAVE_KEY,
  clearPendingGridStrategySave,
  readPendingGridStrategyLibrary,
  readPendingGridStrategySave,
  writePendingGridStrategyLibrary,
  writePendingGridStrategySave,
} from '@/lib/grid/grid-strategy-pending-save';
import { validateGridParams } from '@/lib/grid-validate-params';
import { DEFAULT_GRID_PARAMS } from '@/types/grid';

function buildPayload() {
  const validation = validateGridParams(DEFAULT_GRID_PARAMS);
  const resultSnapshot = runGridCalculation(
    DEFAULT_GRID_PARAMS,
    { dynamicGridEnabled: false, dynamicGridMode: 'stable' },
    validation
  );
  return {
    config: {
      params: DEFAULT_GRID_PARAMS,
      dynamicGridEnabled: false,
      dynamicGridMode: 'stable' as const,
    },
    resultSnapshot,
  };
}

describe('grid-strategy-pending-save', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it('合法 payload 可 round-trip 且读取不自动删除', () => {
    const payload = buildPayload();
    writePendingGridStrategySave(payload, window.sessionStorage);
    const read = readPendingGridStrategySave(window.sessionStorage);
    expect(read).toEqual({
      ...payload,
      config: { ...payload.config, note: '' },
    });
    expect(window.sessionStorage.getItem(PENDING_GRID_STRATEGY_SAVE_KEY)).not.toBeNull();
    clearPendingGridStrategySave(window.sessionStorage);
    expect(window.sessionStorage.getItem(PENDING_GRID_STRATEGY_SAVE_KEY)).toBeNull();
  });

  it('过期与损坏返回 null 并清理键', () => {
    const payload = buildPayload();
    writePendingGridStrategySave(
      payload,
      window.sessionStorage,
      new Date('2026-01-01T00:00:00.000Z')
    );
    expect(
      readPendingGridStrategySave(
        window.sessionStorage,
        new Date('2026-01-01T01:00:00.000Z')
      )
    ).toBeNull();
    expect(window.sessionStorage.getItem(PENDING_GRID_STRATEGY_SAVE_KEY)).toBeNull();

    window.sessionStorage.setItem(PENDING_GRID_STRATEGY_SAVE_KEY, '{not-json');
    expect(readPendingGridStrategySave(window.sessionStorage)).toBeNull();
  });

  it('pending-save 与 pending-library 互斥', () => {
    const payload = buildPayload();
    writePendingGridStrategySave(payload, window.sessionStorage);
    writePendingGridStrategyLibrary(window.sessionStorage);
    expect(window.sessionStorage.getItem(PENDING_GRID_STRATEGY_SAVE_KEY)).toBeNull();
    expect(readPendingGridStrategyLibrary(window.sessionStorage)).toBe(true);

    writePendingGridStrategySave(payload, window.sessionStorage);
    expect(window.sessionStorage.getItem(PENDING_GRID_STRATEGY_LIBRARY_KEY)).toBeNull();
  });
});
