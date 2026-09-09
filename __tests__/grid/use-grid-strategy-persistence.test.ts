/**
 * @jest-environment jsdom
 */
import { createElement, useEffect, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { User } from '@supabase/supabase-js';
import {
  useGridStrategyPersistence,
  type UseGridStrategyPersistenceReturn,
} from '@/hooks/use-grid-strategy-persistence';
import type { GridStrategyRepository } from '@/lib/supabase/grid-strategy-repository';
import {
  PENDING_GRID_STRATEGY_LIBRARY_KEY,
  PENDING_GRID_STRATEGY_SAVE_KEY,
  writePendingGridStrategyLibrary,
  writePendingGridStrategySave,
} from '@/lib/grid/grid-strategy-pending-save';
import { runGridCalculation } from '@/lib/grid-run-calculation';
import { validateGridParams } from '@/lib/grid-validate-params';
import { DEFAULT_GRID_PARAMS } from '@/types/grid';
import type {
  GridStrategyMetadata,
  GridStrategySavePayload,
  SavedGridStrategyV1,
} from '@/types/grid-strategy-storage';

const getUserMock = jest.fn();

jest.mock('@/lib/supabase/client', () => ({
  createBrowserSupabaseClient: () => ({
    auth: {
      getUser: getUserMock,
    },
  }),
}));

function buildPayload(): GridStrategySavePayload {
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
      dynamicGridMode: 'stable',
    },
    resultSnapshot,
  };
}

function meta(partial: Partial<GridStrategyMetadata> = {}): GridStrategyMetadata {
  return {
    id: 'strategy-1',
    name: '策略一',
    symbol: '',
    schemaVersion: 1,
    createdAt: '2026-08-07T01:00:00.000Z',
    updatedAt: '2026-08-07T02:00:00.000Z',
    ...partial,
  };
}

describe('useGridStrategyPersistence', () => {
  let container: HTMLDivElement;
  let root: Root;
  let latest: UseGridStrategyPersistenceReturn | null;
  let onOpenStrategy: jest.Mock;
  let onRestorePendingSave: jest.Mock;
  let onDeleteCurrentStrategy: jest.Mock;
  let repository: {
    list: jest.Mock;
    get: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    rename: jest.Mock;
    delete: jest.Mock;
  };

  beforeAll(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
  });

  beforeEach(() => {
    window.sessionStorage.clear();
    onOpenStrategy = jest.fn();
    onRestorePendingSave = jest.fn();
    onDeleteCurrentStrategy = jest.fn();
    repository = {
      list: jest.fn().mockResolvedValue([]),
      get: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      rename: jest.fn(),
      delete: jest.fn(),
    };
    getUserMock.mockResolvedValue({ data: { user: null }, error: null });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    latest = null;
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  function Harness() {
    const api = useGridStrategyPersistence({
      onOpenStrategy,
      onRestorePendingSave,
      onDeleteCurrentStrategy,
      repository: repository as unknown as GridStrategyRepository,
    });
    useEffect(() => {
      latest = api;
    });
    return null;
  }

  async function mount() {
    await act(async () => {
      root.render(createElement(Harness));
    });
  }

  it('无 session 时不自动弹窗、不读列表', async () => {
    await mount();
    expect(latest?.user).toBeNull();
    expect(latest?.loginOpen).toBe(false);
    expect(repository.list).not.toHaveBeenCalled();
  });

  it('有用户且存在 pending-save 时恢复并清理', async () => {
    const payload = buildPayload();
    writePendingGridStrategySave(payload, window.sessionStorage);
    getUserMock.mockResolvedValue({
      data: { user: { id: 'user-1' } as User },
      error: null,
    });

    await mount();
    await act(async () => {
      await Promise.resolve();
    });

    expect(onRestorePendingSave).toHaveBeenCalledWith(payload);
    expect(window.sessionStorage.getItem(PENDING_GRID_STRATEGY_SAVE_KEY)).toBeNull();
  });

  it('openLibrary 无 session 时写入 pending-library 并打开登录', async () => {
    await mount();
    await act(async () => {
      await latest!.openLibrary();
    });
    expect(latest!.loginOpen).toBe(true);
    expect(latest!.loginPurpose).toBe('library');
    expect(window.sessionStorage.getItem(PENDING_GRID_STRATEGY_LIBRARY_KEY)).not.toBeNull();
  });

  it('openLibrary 有 session 时加载元数据', async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: 'user-1' } as User },
      error: null,
    });
    repository.list.mockResolvedValue([meta()]);
    await mount();
    await act(async () => {
      await latest!.openLibrary();
    });
    expect(repository.list).toHaveBeenCalled();
    expect(latest!.libraryOpen).toBe(true);
    expect(latest!.strategies).toHaveLength(1);
  });

  it('create 成功后更新 currentStrategy 与列表排序', async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: 'user-1' } as User },
      error: null,
    });
    const created: SavedGridStrategyV1 = {
      ...meta({
        id: 'strategy-2',
        name: '新策略',
        updatedAt: '2026-08-07T05:00:00.000Z',
      }),
      config: buildPayload().config,
      resultSnapshot: buildPayload().resultSnapshot,
    };
    repository.create.mockResolvedValue(created);
    await mount();
    await act(async () => {
      await latest!.createStrategy('新策略', buildPayload());
    });
    expect(latest!.currentStrategy?.id).toBe('strategy-2');
    expect(latest!.strategies[0]?.id).toBe('strategy-2');
  });

  it('会话失效打开登录但不触发删除回调', async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: 'user-1' } as User },
      error: null,
    });
    repository.list.mockRejectedValue(new Error('登录状态已失效，请重新登录'));
    await mount();
    await act(async () => {
      await latest!.openLibrary();
    });
    expect(latest!.loginOpen).toBe(true);
    expect(onDeleteCurrentStrategy).not.toHaveBeenCalled();
  });

  it('有 pending-library 时自动打开抽屉', async () => {
    writePendingGridStrategyLibrary(window.sessionStorage);
    getUserMock.mockResolvedValue({
      data: { user: { id: 'user-1' } as User },
      error: null,
    });
    repository.list.mockResolvedValue([meta()]);
    await mount();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(latest!.libraryOpen).toBe(true);
    expect(window.sessionStorage.getItem(PENDING_GRID_STRATEGY_LIBRARY_KEY)).toBeNull();
  });
});
