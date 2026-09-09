'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { GridStrategyRepository } from '@/lib/supabase/grid-strategy-repository';
import type {
  GridStrategyMetadata,
  GridStrategySavePayload,
  SavedGridStrategyV1,
} from '@/types/grid-strategy-storage';
import {
  clearAllGridStrategyPendingIntents,
  clearPendingGridStrategyLibrary,
  clearPendingGridStrategySave,
  readPendingGridStrategyLibrary,
  readPendingGridStrategySave,
  writePendingGridStrategyLibrary,
  writePendingGridStrategySave,
} from '@/lib/grid/grid-strategy-pending-save';

export interface UseGridStrategyPersistenceOptions {
  onOpenStrategy: (strategy: SavedGridStrategyV1) => void;
  onRestorePendingSave: (payload: GridStrategySavePayload) => void;
  onDeleteCurrentStrategy: () => void;
  /** 测试可注入；默认用浏览器 Supabase 客户端 */
  repository?: GridStrategyRepository;
}

export interface UseGridStrategyPersistenceReturn {
  user: User | null;
  authLoading: boolean;
  loginOpen: boolean;
  setLoginOpen: (open: boolean) => void;
  /** 保存入口登录文案 vs 策略库入口 */
  loginPurpose: 'save' | 'library';
  libraryOpen: boolean;
  strategies: GridStrategyMetadata[];
  listLoading: boolean;
  listError: string | null;
  currentStrategy: GridStrategyMetadata | null;
  openLibrary: () => Promise<void>;
  closeLibrary: () => void;
  openStrategy: (id: string) => Promise<void>;
  createStrategy: (name: string, payload: GridStrategySavePayload) => Promise<void>;
  updateCurrentStrategy: (payload: GridStrategySavePayload) => Promise<void>;
  renameStrategy: (id: string, name: string, symbol?: string) => Promise<void>;
  deleteStrategy: (id: string) => Promise<void>;
  requireLoginForSave: (payload: GridStrategySavePayload) => boolean;
  handleSignedOut: () => void;
  actionId: string | null;
  writeLoading: boolean;
}

function sortByUpdatedAtDesc(items: GridStrategyMetadata[]): GridStrategyMetadata[] {
  return [...items].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

function getSessionStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  return window.sessionStorage;
}

/**
 * 网格策略登录、列表与 CRUD 编排（不含页面结果 state）。
 */
export function useGridStrategyPersistence(
  options: UseGridStrategyPersistenceOptions
): UseGridStrategyPersistenceReturn {
  const { onOpenStrategy, onRestorePendingSave, onDeleteCurrentStrategy, repository } =
    options;
  const repo = useMemo(
    () => repository ?? new GridStrategyRepository(createBrowserSupabaseClient()),
    [repository]
  );

  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginPurpose, setLoginPurpose] = useState<'save' | 'library'>('save');
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [strategies, setStrategies] = useState<GridStrategyMetadata[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [currentStrategy, setCurrentStrategy] = useState<GridStrategyMetadata | null>(
    null
  );
  const [actionId, setActionId] = useState<string | null>(null);
  const [writeLoading, setWriteLoading] = useState(false);
  const openingRef = useRef(false);
  const restoredRef = useRef(false);

  const handleAuthError = useCallback((error: unknown): boolean => {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('登录状态已失效')) {
      setUser(null);
      setLoginOpen(true);
      return true;
    }
    return false;
  }, []);

  const refreshList = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    try {
      const rows = await repo.list();
      setStrategies(rows);
    } catch (error) {
      if (!handleAuthError(error)) {
        setListError(error instanceof Error ? error.message : '加载策略列表失败');
      }
    } finally {
      setListLoading(false);
    }
  }, [handleAuthError, repo]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const client = createBrowserSupabaseClient();
        const { data, error } = await client.auth.getUser();
        if (cancelled) return;
        const nextUser = !error && data.user ? data.user : null;
        setUser(nextUser);

        const storage = getSessionStorage();
        if (!storage || restoredRef.current) return;
        restoredRef.current = true;

        if (nextUser) {
          const pendingSave = readPendingGridStrategySave(storage);
          if (pendingSave) {
            onRestorePendingSave(pendingSave);
            clearAllGridStrategyPendingIntents(storage);
            return;
          }
          if (readPendingGridStrategyLibrary(storage)) {
            setLibraryOpen(true);
            try {
              const rows = await repo.list();
              if (!cancelled) {
                setStrategies(rows);
                clearPendingGridStrategyLibrary(storage);
              }
            } catch (listError) {
              if (!cancelled) {
                if (!handleAuthError(listError)) {
                  setListError(
                    listError instanceof Error
                      ? listError.message
                      : '加载策略列表失败'
                  );
                }
              }
            }
          }
        }
      } finally {
        if (!cancelled) setAuthLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [handleAuthError, onRestorePendingSave, repo]);

  const openLibrary = useCallback(async () => {
    const storage = getSessionStorage();
    if (!user) {
      if (storage) writePendingGridStrategyLibrary(storage);
      setLoginPurpose('library');
      setLoginOpen(true);
      return;
    }
    setLibraryOpen(true);
    await refreshList();
  }, [refreshList, user]);

  const closeLibrary = useCallback(() => {
    setLibraryOpen(false);
    const storage = getSessionStorage();
    if (storage) clearPendingGridStrategyLibrary(storage);
  }, []);

  const openStrategy = useCallback(
    async (id: string) => {
      if (openingRef.current) return;
      openingRef.current = true;
      setActionId(id);
      try {
        const strategy = await repo.get(id);
        setCurrentStrategy({
          id: strategy.id,
          name: strategy.name,
          symbol: strategy.symbol,
          schemaVersion: strategy.schemaVersion,
          createdAt: strategy.createdAt,
          updatedAt: strategy.updatedAt,
        });
        onOpenStrategy(strategy);
        setLibraryOpen(false);
      } catch (error) {
        if (!handleAuthError(error)) {
          throw error;
        }
      } finally {
        openingRef.current = false;
        setActionId(null);
      }
    },
    [handleAuthError, onOpenStrategy, repo]
  );

  const createStrategy = useCallback(
    async (name: string, payload: GridStrategySavePayload) => {
      setWriteLoading(true);
      try {
        const created = await repo.create(name, payload);
        const meta: GridStrategyMetadata = {
          id: created.id,
          name: created.name,
          symbol: created.symbol,
          schemaVersion: created.schemaVersion,
          createdAt: created.createdAt,
          updatedAt: created.updatedAt,
        };
        setCurrentStrategy(meta);
        setStrategies(prev =>
          sortByUpdatedAtDesc([meta, ...prev.filter(s => s.id !== meta.id)])
        );
        const storage = getSessionStorage();
        if (storage) clearPendingGridStrategySave(storage);
      } catch (error) {
        if (handleAuthError(error)) {
          const storage = getSessionStorage();
          if (storage) writePendingGridStrategySave(payload, storage);
        }
        throw error;
      } finally {
        setWriteLoading(false);
      }
    },
    [handleAuthError, repo]
  );

  const updateCurrentStrategy = useCallback(
    async (payload: GridStrategySavePayload) => {
      if (!currentStrategy) {
        throw new Error('策略不存在或无权访问');
      }
      setWriteLoading(true);
      try {
        const updated = await repo.update(currentStrategy.id, payload);
        const meta: GridStrategyMetadata = {
          id: updated.id,
          name: updated.name,
          symbol: updated.symbol,
          schemaVersion: updated.schemaVersion,
          createdAt: updated.createdAt,
          updatedAt: updated.updatedAt,
        };
        setCurrentStrategy(meta);
        setStrategies(prev =>
          sortByUpdatedAtDesc([meta, ...prev.filter(s => s.id !== meta.id)])
        );
      } catch (error) {
        if (handleAuthError(error)) {
          const storage = getSessionStorage();
          if (storage) writePendingGridStrategySave(payload, storage);
        }
        throw error;
      } finally {
        setWriteLoading(false);
      }
    },
    [currentStrategy, handleAuthError, repo]
  );

  const renameStrategy = useCallback(
    async (id: string, name: string, symbol?: string) => {
      setActionId(id);
      setWriteLoading(true);
      try {
        const meta = await repo.rename(id, name, symbol);
        setStrategies(prev =>
          sortByUpdatedAtDesc([meta, ...prev.filter(s => s.id !== meta.id)])
        );
        setCurrentStrategy(prev => (prev?.id === id ? meta : prev));
      } catch (error) {
        handleAuthError(error);
        throw error;
      } finally {
        setWriteLoading(false);
        setActionId(null);
      }
    },
    [handleAuthError, repo]
  );

  const deleteStrategy = useCallback(
    async (id: string) => {
      setActionId(id);
      setWriteLoading(true);
      try {
        await repo.delete(id);
        setStrategies(prev => prev.filter(s => s.id !== id));
        if (currentStrategy?.id === id) {
          setCurrentStrategy(null);
          onDeleteCurrentStrategy();
        }
      } catch (error) {
        handleAuthError(error);
        throw error;
      } finally {
        setWriteLoading(false);
        setActionId(null);
      }
    },
    [currentStrategy?.id, handleAuthError, onDeleteCurrentStrategy, repo]
  );

  const requireLoginForSave = useCallback(
    (payload: GridStrategySavePayload): boolean => {
      if (user) return false;
      const storage = getSessionStorage();
      if (storage) writePendingGridStrategySave(payload, storage);
      setLoginPurpose('save');
      setLoginOpen(true);
      return true;
    },
    [user]
  );

  const handleSignedOut = useCallback(() => {
    setUser(null);
    setCurrentStrategy(null);
    setStrategies([]);
    setListError(null);
    setLibraryOpen(false);
    setLoginOpen(false);
    const storage = getSessionStorage();
    if (storage) clearAllGridStrategyPendingIntents(storage);
  }, []);

  return {
    user,
    authLoading,
    loginOpen,
    setLoginOpen,
    loginPurpose,
    libraryOpen,
    strategies,
    listLoading,
    listError,
    currentStrategy,
    openLibrary,
    closeLibrary,
    openStrategy,
    createStrategy,
    updateCurrentStrategy,
    renameStrategy,
    deleteStrategy,
    requireLoginForSave,
    handleSignedOut,
    actionId,
    writeLoading,
  };
}
