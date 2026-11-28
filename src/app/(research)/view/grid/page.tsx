'use client';

import { LoginModal } from '@/components/auth/login-modal';
import { UserMenu } from '@/components/auth/user-menu';
import { ErrorAlert } from '@/components/grid/error-alert';
import { GridAntdProvider } from '@/components/grid/grid-antd-provider';
import { GridParamsPanel } from '@/components/grid/grid-params-panel';
import { GridParamsSummaryBar } from '@/components/grid/grid-params-summary-bar';
import { GridPrimaryKpiRow } from '@/components/grid/grid-primary-kpi-row';
import { GridPortfolioBoard } from '@/components/grid/grid-portfolio-board';
import { GridResultTable } from '@/components/grid/grid-result-table';
import { GridStrategyLibraryDrawer } from '@/components/grid/grid-strategy-library-drawer';
import { GridStrategyNameOverlay } from '@/components/grid/grid-strategy-name-overlay';
import { GridTradeEntryModal } from '@/components/grid/grid-trade-entry-modal';
import type { GridTradeEntryDefaults } from '@/components/grid/grid-trade-entry-modal';
import { GridTradeJournal } from '@/components/grid/grid-trade-journal';
import { LazyStrategyComparisonChart } from '@/components/grid/lazy-strategy-comparison-chart';
import { StatsCards } from '@/components/grid/stats-cards';
import { useGridCalculator } from '@/hooks/use-grid-calculator';
import { useGridParams } from '@/hooks/use-grid-params';
import { useGridStrategyPersistence } from '@/hooks/use-grid-strategy-persistence';
import { useGridStrategyTrades } from '@/hooks/use-grid-strategy-trades';
import type { GridRunResult } from '@/lib/grid-run-calculation';
import {
  getGridStrategySaveState,
  hasDiscardableGridChanges,
  isDraftConfigDirty,
} from '@/lib/grid/grid-strategy-workflow';
import { normalizeJournalStrategyId } from '@/lib/grid/grid-journal-filter';
import { describeError } from '@/lib/describe-error';
import { formatGridAmount, formatGridPrice } from '@/lib/grid/format-grid-amount';
import { extractEtfCode } from '@/lib/grid/grid-board-close-quote';
import {
  computeOpenPositionQuote,
  computeStrategyTradeStats,
  defaultSellQty,
  getLevelExecuteState,
} from '@/lib/grid/grid-strategy-trade-stats';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { fetchLatestEtfCloses } from '@/lib/supabase/etf-daily-repository';
import { GridStrategyRepository } from '@/lib/supabase/grid-strategy-repository';
import { MOTION, isReducedMotion } from '@/lib/motion';
import { DEFAULT_GRID_PARAMS } from '@/types/grid';
import type {
  GridStrategyConfigV1,
  GridStrategyMetadata,
  GridStrategySavePayload,
  SavedGridStrategyV1,
} from '@/types/grid-strategy-storage';
import { useGSAP } from '@gsap/react';
import { App, Button, Card, Drawer, Empty, Grid, Tabs } from 'antd';
import { gsap } from 'gsap';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';


/**
 * 网格交易策略页（Coinbase 双态布局 + 云端保存）。
 */
export default function GridStrategyPage() {
  return (
    <div className="relative overflow-x-hidden text-[var(--foreground)] animate-[fade-in_0.24s_var(--ease-out-expo)_both]">
      <GridAntdProvider>
        <GridStrategyPageInner />
      </GridAntdProvider>
    </div>
  );
}

function GridStrategyPageInner() {
  const { modal, message } = App.useApp();
  const [result, setResult] = useState<GridRunResult | null>(null);
  const [generatedConfig, setGeneratedConfig] =
    useState<GridStrategyConfigV1 | null>(null);
  const [generatedDirty, setGeneratedDirty] = useState(false);
  const [dynamicGridEnabled, setDynamicGridEnabled] = useState(false);
  const [dynamicGridMode, setDynamicGridMode] = useState<
    'stable' | 'aggressive'
  >('stable');
  const [paramsDrawerOpen, setParamsDrawerOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [nameModalOpen, setNameModalOpen] = useState(false);
  const [nameModalMode, setNameModalMode] = useState<'create' | 'rename'>(
    'create'
  );
  const [renameTarget, setRenameTarget] = useState<GridStrategyMetadata | null>(
    null
  );
  const [nameModalError, setNameModalError] = useState<string | null>(null);
  const [mainTab, setMainTab] = useState<'calc' | 'board' | 'journal'>('calc');
  // 跟踪最新 tab：异步打开完成后若用户已手动切走，则不再强行切回
  const mainTabRef = useRef<'calc' | 'board' | 'journal'>('calc');
  const switchMainTab = (tab: 'calc' | 'board' | 'journal') => {
    mainTabRef.current = tab;
    setMainTab(tab);
  };
  const [openingStrategyId, setOpeningStrategyId] = useState<string | null>(
    null
  );
  const [boardStrategies, setBoardStrategies] = useState<SavedGridStrategyV1[]>(
    []
  );
  const [boardLoading, setBoardLoading] = useState(false);
  // 首次拉取是否已结束：区分"还没加载"与"加载完确实为空"，深链筛选不被提前归一
  const [boardFetched, setBoardFetched] = useState(false);
  const [journalStrategyFilter, setJournalStrategyFilter] = useState<
    string | 'all'
  >('all');
  const [tradeDefaults, setTradeDefaults] =
    useState<GridTradeEntryDefaults | null>(null);
  /** 记账弹窗开合布尔，与 defaults 数据解耦：defaults 保留到 afterClose 再清，完整保留退场动画 */
  const [tradeModalOpen, setTradeModalOpen] = useState(false);
  const [tradeSubmitting, setTradeSubmitting] = useState(false);
  const [latestClose, setLatestClose] = useState<number | null>(null);
  const shellRef = useRef<HTMLElement | null>(null);
  const resultRegionRef = useRef<HTMLDivElement | null>(null);
  /** 结果区整组卡片入场只在「首次生成」播放，后续替换降级为纯淡切 */
  const resultEntrancePlayedRef = useRef(false);

  const screens = Grid.useBreakpoint();

  useEffect(() => {
    setIsMobile(!(screens.md ?? false));
  }, [screens.md]);

  useEffect(() => {
    shellRef.current = document.querySelector('.grid-shell');
  }, []);

  const {
    params,
    updateParam,
    setAlignLastGridToStep,
    replaceParams,
    validateParams,
    errors,
    priceDecimals,
  } = useGridParams(DEFAULT_GRID_PARAMS);

  const { calculateGrid } = useGridCalculator({
    params,
    validateParams,
    dynamicGridEnabled,
    dynamicGridMode,
  });

  const draftConfig: GridStrategyConfigV1 = useMemo(
    () => ({
      params,
      dynamicGridEnabled,
      dynamicGridMode,
    }),
    [params, dynamicGridEnabled, dynamicGridMode]
  );

  // 草稿基线：从未生成结果时的对照物。新建重置回到默认，打开/保存后随配置更新，
  // 使"首次生成前"的参数编辑也纳入放弃确认（否则会被静默丢弃）
  const baselineConfigRef = useRef<GridStrategyConfigV1>({
    params: DEFAULT_GRID_PARAMS,
    dynamicGridEnabled: false,
    dynamicGridMode: 'stable',
  });
  const draftDirty = isDraftConfigDirty(
    draftConfig,
    generatedConfig,
    baselineConfigRef.current
  );

  const applyOpenedStrategy = useCallback(
    (strategy: SavedGridStrategyV1) => {
      replaceParams(strategy.config.params);
      setDynamicGridEnabled(strategy.config.dynamicGridEnabled);
      setDynamicGridMode(strategy.config.dynamicGridMode);
      setGeneratedConfig(strategy.config);
      baselineConfigRef.current = strategy.config;
      setResult(strategy.resultSnapshot);
      setGeneratedDirty(false);
      setParamsDrawerOpen(false);
    },
    [replaceParams]
  );

  const persistence = useGridStrategyPersistence({
    onOpenStrategy: applyOpenedStrategy,
    onRestorePendingSave: (payload: GridStrategySavePayload) => {
      replaceParams(payload.config.params);
      setDynamicGridEnabled(payload.config.dynamicGridEnabled);
      setDynamicGridMode(payload.config.dynamicGridMode);
      setGeneratedConfig(payload.config);
      setResult(payload.resultSnapshot);
      setGeneratedDirty(true);
      setNameModalMode('create');
      setRenameTarget(null);
      setNameModalError(null);
      setNameModalOpen(true);
      message.success('已恢复待保存策略，请命名后保存');
    },
    onDeleteCurrentStrategy: () => {
      setGeneratedDirty(true);
    },
  });

  const tradesApi = useGridStrategyTrades({
    enabled: Boolean(persistence.user),
  });

  const strategyRepo = useMemo(
    () => new GridStrategyRepository(createBrowserSupabaseClient()),
    []
  );

  const refreshBoardStrategies = useCallback(async () => {
    if (!persistence.user) {
      setBoardStrategies([]);
      return;
    }
    setBoardLoading(true);
    try {
      const list = await strategyRepo.listAll();
      setBoardStrategies(list);
    } catch (error) {
      message.error(describeError(error, '加载看板失败，请重试'));
      setBoardStrategies([]);
    } finally {
      setBoardLoading(false);
      setBoardFetched(true);
    }
  }, [message, persistence.user, strategyRepo]);

  useLayoutEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    if (tab === 'board' || tab === 'journal' || tab === 'calc') switchMainTab(tab);
    const strategyId = params.get('strategy');
    if (tab === 'journal' && strategyId) setJournalStrategyFilter(strategyId);
  }, []);

  const openedStrategyQuery = useRef(false);
  useEffect(() => {
    if (!persistence.user || openedStrategyQuery.current) return;
    const params = new URLSearchParams(window.location.search);
    const id = params.get('strategy');
    const tab = params.get('tab');
    if (!id || tab === 'journal' || tab === 'board') return;
    openedStrategyQuery.current = true;
    void persistence.openStrategy(id).catch(error => {
      message.error(describeError(error, '打开失败，请重试'));
    });
  }, [message, persistence.user, persistence.openStrategy]);

  useEffect(() => {
    if (mainTab === 'board' || mainTab === 'journal') {
      void refreshBoardStrategies();
    }
  }, [mainTab, refreshBoardStrategies, persistence.strategies]);

  useEffect(() => {
    const normalized = normalizeJournalStrategyId(
      journalStrategyFilter,
      boardStrategies.map(strategy => strategy.id),
      boardLoading || !boardFetched
    );
    if (normalized !== journalStrategyFilter) {
      setJournalStrategyFilter(normalized);
    }
  }, [boardLoading, boardFetched, boardStrategies, journalStrategyFilter]);

  // 页签与流水筛选写回 URL：刷新/分享后停在当前位置，不用用户重找（能替人做的直接做）。
  // 跳过首次运行：挂载首帧写回会抢在深链（?tab&strategy）被异步消费之前把它抹掉
  const urlSyncInitRef = useRef(false);
  useEffect(() => {
    if (!urlSyncInitRef.current) {
      urlSyncInitRef.current = true;
      return;
    }
    const params = new URLSearchParams(window.location.search);
    params.set('tab', mainTab);
    if (mainTab === 'journal' && journalStrategyFilter !== 'all') {
      params.set('strategy', journalStrategyFilter);
    } else {
      params.delete('strategy');
    }
    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}?${params.toString()}`
    );
  }, [mainTab, journalStrategyFilter]);

  const currentStrategyTrades = useMemo(() => {
    const id = persistence.currentStrategy?.id;
    if (!id) return [];
    return tradesApi.trades.filter(t => t.strategyId === id);
  }, [persistence.currentStrategy?.id, tradesApi.trades]);

  const quoteSymbol = persistence.currentStrategy?.symbol ?? '';

  useEffect(() => {
    const code = extractEtfCode(quoteSymbol);
    if (!code) {
      setLatestClose(null);
      return;
    }
    let cancelled = false;
    void fetchLatestEtfCloses(createBrowserSupabaseClient(), [code])
      .then(map => {
        if (!cancelled) setLatestClose(map.get(code)?.close ?? null);
      })
      .catch(() => {
        if (!cancelled) setLatestClose(null);
      });
    return () => {
      cancelled = true;
    };
  }, [quoteSymbol]);

  const positionQuote = useMemo(() => {
    const levelKeys = result?.legs.map(leg => leg.id) ?? [];
    const stats = computeStrategyTradeStats(currentStrategyTrades, levelKeys);
    const quote = computeOpenPositionQuote(stats, latestClose, currentStrategyTrades, {
      buyCommissionRate: params.buyCommissionRate,
      sellCommissionRate: params.sellCommissionRate,
      minCommission: params.minCommission,
      stampDutyRate: params.stampDutyRate,
      transferFeeRate: params.transferFeeRate,
    });
    if (quote.openShares <= 0 || quote.costPrice == null) {
      return { marketValue: '—', openShares: '—', costPrice: '—' };
    }
    return {
      marketValue:
        quote.marketValue == null ? '—' : formatGridAmount(quote.marketValue),
      openShares: quote.openShares.toLocaleString('zh-CN'),
      costPrice: formatGridPrice(quote.costPrice, params.priceUnit),
    };
  }, [
    currentStrategyTrades,
    latestClose,
    params.buyCommissionRate,
    params.minCommission,
    params.priceUnit,
    params.sellCommissionRate,
    params.stampDutyRate,
    params.transferFeeRate,
    result,
  ]);

  const getLevelQty = useCallback(
    (levelKey: string) => {
      const list = currentStrategyTrades.filter(t => t.levelKey === levelKey);
      const q = getLevelExecuteState(list);
      return {
        openQty: q.openQty,
        rounds: q.rounds,
        awaitingSell: q.awaitingSell,
      };
    },
    [currentStrategyTrades]
  );

  const openTrade = useCallback(
    (side: 'buy' | 'sell', levelKey: string) => {
      if (!persistence.currentStrategy || !result) {
        message.warning('请先保存策略后再记账');
        return;
      }
      const leg = result.legs.find(l => l.id === levelKey);
      if (!leg) {
        message.error('档位不存在或已失效');
        return;
      }
      const q = getLevelQty(levelKey);
      if (side === 'sell' && q.openQty <= 0) {
        message.warning('该档无持仓可卖');
        return;
      }
      setTradeDefaults({
        side,
        levelKey,
        price: side === 'buy' ? leg.buyPrice : leg.sellPrice,
        qty:
          side === 'buy'
            ? leg.buyShares
            : defaultSellQty(q.openQty, leg.sellShares),
        maxSellQty: side === 'sell' ? q.openQty : undefined,
        priceDecimals,
      });
      setTradeModalOpen(true);
    },
    [getLevelQty, message, persistence.currentStrategy, priceDecimals, result]
  );

  const hasResult =
    result !== null &&
    result.gridData.length > 0 &&
    result.stressTest !== null &&
    result.calculationErrors.length === 0;

  /**
   * 结果区入场语言：首次生成时 KPI 行/图卡/明细卡/表格卡 fade+translateY stagger 进场；
   * 重新生成、打开云端策略、恢复草稿共用「内容替换」语言——整区纯淡切并让摘要条
   * 策略名/参数摘要微闪一次，交代「内容换了」而不重播整列。
   */
  useGSAP(
    () => {
      const region = resultRegionRef.current;
      if (!region || isReducedMotion()) return;
      if (!resultEntrancePlayedRef.current) {
        resultEntrancePlayedRef.current = true;
        const cards = region.querySelectorAll('.grid-result-card');
        gsap.fromTo(
          cards,
          { autoAlpha: 0, y: 12 },
          {
            autoAlpha: 1,
            y: 0,
            duration: MOTION.duration.medium,
            ease: MOTION.ease.out,
            stagger: MOTION.stagger.card,
          }
        );
        return;
      }
      gsap.fromTo(
        region,
        { autoAlpha: 0.35 },
        {
          autoAlpha: 1,
          duration: MOTION.duration.small,
          ease: MOTION.ease.out,
        }
      );
      const summaryBits = document.querySelectorAll(
        '.grid-summary-bar__strategy-name, .grid-summary-bar__meta'
      );
      if (summaryBits.length > 0) {
        gsap.fromTo(
          summaryBits,
          { autoAlpha: 0.35 },
          {
            autoAlpha: 1,
            duration: MOTION.duration.small,
            ease: MOTION.ease.out,
          }
        );
      }
    },
    { dependencies: [result] }
  );

  const saveState = getGridStrategySaveState({
    hasResult,
    hasCloudId: persistence.currentStrategy !== null,
    draftDirty,
    generatedDirty,
  });

  const buildSavePayload = (): GridStrategySavePayload | null => {
    if (!generatedConfig || !result || !hasResult) return null;
    return {
      config: {
        ...generatedConfig,
        note:
          generatedConfig.note ||
          persistence.currentStrategy?.note ||
          '',
      },
      resultSnapshot: result,
    };
  };

  const confirmDiscardIfNeeded = (
    onConfirm: () => void,
    kind: 'open' | 'create' = 'open'
  ) => {
    const discardable = hasDiscardableGridChanges({
      hasResult,
      hasCloudId: persistence.currentStrategy !== null,
      draftDirty,
      generatedDirty,
    });
    if (!discardable) {
      onConfirm();
      return;
    }
    modal.confirm({
      title: '放弃未保存的更改？',
      content:
        kind === 'create'
          ? '当前有未保存的结果或尚未重新生成的参数修改，另起一份将覆盖当前页面。云端已保存的策略不会被删除。'
          : '当前有未保存的结果或尚未重新生成的参数修改，打开其他策略将覆盖当前页面。',
      okText: kind === 'create' ? '放弃并新建' : '放弃并打开',
      cancelText: '取消',
      onOk: onConfirm,
    });
  };

  const resetCalculatorDraft = () => {
    replaceParams(DEFAULT_GRID_PARAMS);
    setDynamicGridEnabled(false);
    setDynamicGridMode('stable');
    setResult(null);
    setGeneratedConfig(null);
    setGeneratedDirty(false);
    setParamsDrawerOpen(false);
    baselineConfigRef.current = {
      params: DEFAULT_GRID_PARAMS,
      dynamicGridEnabled: false,
      dynamicGridMode: 'stable',
    };
  };

  const handleCreateGridStrategy = () => {
    confirmDiscardIfNeeded(() => {
      persistence.clearCurrentStrategy();
      resetCalculatorDraft();
      switchMainTab('calc');
    }, 'create');
  };

  const applyCalculationResult = () => {
    const validation = validateParams();
    if (!validation.isValid) {
      message.error('请检查参数设置');
      return false;
    }

    const next = calculateGrid();

    if (next.calculationErrors.length > 0) {
      setResult(next);
      message.error(next.calculationErrors[0]);
      return false;
    }

    setResult(next);
    setGeneratedConfig({
      params: { ...params },
      dynamicGridEnabled,
      dynamicGridMode,
      note:
        generatedConfig?.note ||
        persistence.currentStrategy?.note ||
        '',
    });
    setGeneratedDirty(true);
    message.success('策略已生成');
    return true;
  };

  /**
   * 生成成功后滚动到 KPI 行：reduced-motion 退化为瞬时定位；
   * 延迟 120ms 与结果入场错峰，避免滚动与新内容落位同帧双重运动。
   */
  const scrollToPrimaryKpis = useCallback(() => {
    window.setTimeout(() => {
      document.getElementById('grid-primary-kpis')?.scrollIntoView({
        behavior: isReducedMotion() ? 'auto' : 'smooth',
        block: 'start',
      });
    }, 120);
  }, []);

  const handleGenerateStrategy = () => {
    const ok = applyCalculationResult();
    if (ok) {
      scrollToPrimaryKpis();
    }
  };

  const handleRegenerate = () => {
    const ok = applyCalculationResult();
    if (ok) {
      setParamsDrawerOpen(false);
      scrollToPrimaryKpis();
    }
  };

  const handleSaveClick = () => {
    if (saveState.disabled) return;
    const payload = buildSavePayload();
    if (!payload) return;

    if (persistence.currentStrategy) {
      void (async () => {
        try {
          await persistence.updateCurrentStrategy(payload);
          setGeneratedDirty(false);
        } catch (error) {
          message.error(describeError(error, '更新失败，请重试'));
        }
      })();
      return;
    }

    if (persistence.requireLoginForSave(payload)) return;

    setNameModalMode('create');
    setRenameTarget(null);
    setNameModalError(null);
    setNameModalOpen(true);
  };

  const handleNameSubmit = async (
    name: string,
    symbol: string,
    note: string
  ) => {
    setNameModalError(null);
    try {
      if (nameModalMode === 'rename' && renameTarget) {
        await persistence.renameStrategy(
          renameTarget.id,
          name,
          symbol,
          note
        );
        if (persistence.currentStrategy?.id === renameTarget.id) {
          setGeneratedConfig(prev => (prev ? { ...prev, note } : prev));
        }
        void refreshBoardStrategies();
        return;
      }
      const payload = buildSavePayload();
      if (!payload) {
        const err = new Error('当前没有可保存的结果');
        setNameModalError(err.message);
        throw err;
      }
      await persistence.createStrategy(name, {
        ...payload,
        symbol,
        config: { ...payload.config, note },
      });
      setGeneratedConfig(prev => (prev ? { ...prev, note } : prev));
      if (generatedConfig) {
        baselineConfigRef.current = { ...generatedConfig, note };
      }
      setGeneratedDirty(false);
      void tradesApi.refresh();
      void refreshBoardStrategies();
    } catch (error) {
      setNameModalError(describeError(error, '保存失败，请重试'));
      throw error;
    }
  };

  const handleOpenStrategy = (id: string, onOpened?: () => void) => {
    confirmDiscardIfNeeded(() => {
      setOpeningStrategyId(id);
      void persistence.openStrategy(id)
        .then(opened => {
          // 仅在真正打开成功时回调（防重入跳过 / 登录失效会 resolve false）
          if (opened) onOpened?.();
        })
        .catch(error => {
          message.error(describeError(error, '打开失败，请重试'));
        })
        .finally(() => {
          setOpeningStrategyId(null);
        });
    });
  };

  const handleDeleteStrategy = (strategy: GridStrategyMetadata) => {
    // 库表对 grid_strategy_trades.strategy_id 定义了 ON DELETE CASCADE（见
    // docs/superpowers/specs/2026-09-09-grid-portfolio-journal-design.md），删除必须说清连带后果
    const tradeCount = tradesApi.trades.filter(
      t => t.strategyId === strategy.id
    ).length;
    modal.confirm({
      title: `删除策略「${strategy.name}」？`,
      content:
        tradeCount > 0
          ? `该策略及其 ${tradeCount} 笔成交流水将一并永久删除，无法恢复。`
          : '该策略及其全部成交流水（如有）将一并永久删除，无法恢复。',
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        try {
          await persistence.deleteStrategy(strategy.id);
          await tradesApi.refresh();
          await refreshBoardStrategies();
          message.success('已删除');
        } catch (error) {
          message.error(describeError(error, '删除失败，请重试'));
          throw error;
        }
      },
    });
  };

  const handleSignedOut = () => {
    const wasCloud = persistence.currentStrategy !== null;
    persistence.handleSignedOut();
    setJournalStrategyFilter('all');
    if (wasCloud) {
      resetCalculatorDraft();
    }
  };

  const paramsPanelProps = {
    minTradeUnit: params.minTradeUnit,
    onMinTradeUnitChange: (value: number | null) =>
      updateParam('minTradeUnit', value),
    priceUnit: params.priceUnit,
    onPriceUnitChange: (value: number | null) => updateParam('priceUnit', value),
    basePrice: params.basePrice,
    onBasePriceChange: (value: number | null) => updateParam('basePrice', value),
    minPrice: params.minPrice,
    onMinPriceChange: (value: number | null) => updateParam('minPrice', value),
    amountPerGrid: params.amountPerGrid,
    onAmountPerGridChange: (value: number | null) =>
      updateParam('amountPerGrid', value),
    amountMultiplier: params.amountMultiplier,
    onAmountMultiplierChange: (value: number | null) =>
      updateParam('amountMultiplier', value),
    profitReserveMultiplier: params.profitReserveMultiplier,
    onProfitReserveMultiplierChange: (value: number | null) =>
      updateParam('profitReserveMultiplier', value),
    baseStep: params.smallGridStep,
    onBaseStepChange: (value: number) => updateParam('smallGridStep', value),
    mediumStep: params.mediumGridStep,
    onMediumStepChange: (value: number) => updateParam('mediumGridStep', value),
    largeStep: params.largeGridStep,
    onLargeStepChange: (value: number) => updateParam('largeGridStep', value),
    dynamicEnabled: dynamicGridEnabled,
    onDynamicEnabledChange: setDynamicGridEnabled,
    alignLastGridToStep: params.alignLastGridToStep,
    onAlignLastGridToStepChange: setAlignLastGridToStep,
    mode: dynamicGridMode,
    onModeChange: setDynamicGridMode,
  };

  const generateFooter = (
    <div className="space-y-2">
      <Button
        type="primary"
        size="large"
        shape="round"
        block
        onClick={handleGenerateStrategy}
        disabled={errors.length > 0}
      >
        生成策略
      </Button>
      {errors.length > 0 ? (
        <p className="text-xs text-[var(--loss)]">{errors[0]}</p>
      ) : null}
    </div>
  );

  const regenerateFooter = (
    <div className="space-y-2">
      <Button
        type="primary"
        size="large"
        shape="round"
        block
        onClick={handleRegenerate}
        disabled={errors.length > 0}
      >
        重新生成
      </Button>
      {errors.length > 0 ? (
        <p className="text-xs text-[var(--loss)]">{errors[0]}</p>
      ) : null}
    </div>
  );

  const summaryParams = generatedConfig?.params ?? params;
  const calculationErrors = result?.calculationErrors ?? [];
  const warnings = result?.warnings ?? [];
  const strategyState = result?.state ?? null;
  const stressTest = result?.stressTest ?? null;
  const gridData = result?.gridData ?? [];
  const aggregatedRows = result?.aggregatedRows ?? [];
  const legs = result?.legs ?? [];
  const amountPerGrid = result?.amountPerGrid ?? 0;

  /** 参数告警与跌破边界提示：进场 0fr→1fr 展开加淡入，离场瞬切（见 grid.css .grid-reveal） */
  const statusBlocks = (
    <>
      {warnings.length > 0 && hasResult && (
        <div className="grid-reveal">
          <div className="grid-reveal__inner">
            <div className="mb-4 space-y-2">
              {warnings.map(warning => (
                <div
                  key={warning.code}
                  role="alert"
                  className={`rounded-[var(--radius-compact)] border px-4 py-3 text-sm ${
                    warning.level === 'error'
                      ? 'border-[var(--loss)] bg-[color-mix(in_srgb,var(--loss)_8%,var(--card))]'
                      : 'border-[color-mix(in_srgb,var(--accent-warm)_40%,var(--border))] bg-[color-mix(in_srgb,var(--accent-warm)_6%,var(--card))]'
                  }`}
                >
                  {warning.message}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {strategyState === 'stopped' && (
        <div className="grid-reveal">
          <div className="grid-reveal__inner">
            <div
              role="status"
              className="mb-4 rounded-[var(--radius-compact)] border border-[var(--loss)] bg-[color-mix(in_srgb,var(--loss)_8%,var(--card))] px-4 py-3 text-sm"
            >
              当前价格已跌破最低价边界。本策略不再自动加码，等待价格回到网格区间，或重新调整基准价与最低价。
            </div>
          </div>
        </div>
      )}
    </>
  );

  const loginTitle =
    persistence.loginPurpose === 'library'
      ? '登录以查看我的策略'
      : '登录以保存网格策略';
  const loginDescription =
    '使用 GitHub 账号登录后即可保存和管理网格策略。任意已登录 GitHub 账号均可使用，不限家庭白名单。';

  return (
    <div className="relative">
      <div className="site-container site-container--grid py-6 sm:py-8">
        <header className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-[-0.02em] text-[var(--foreground)] sm:text-3xl">
              网格交易策略
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-[var(--muted-foreground)]">
              配置价格边界与弹药，生成档位并查看资金压力与收益推演
            </p>
          </div>
          <div className="grid-header-actions">
            <Button
              type="primary"
              shape="round"
              onClick={handleCreateGridStrategy}
            >
              创建网格策略
            </Button>
            <Button
              shape="round"
              onClick={() => void persistence.openLibrary()}
            >
              我的策略
            </Button>
            {persistence.user ? (
              <UserMenu
                user={persistence.user}
                onSignedOut={handleSignedOut}
              />
            ) : null}
          </div>
        </header>

        <Tabs
          activeKey={mainTab}
          onChange={key => switchMainTab(key as 'calc' | 'board' | 'journal')}
          className="mb-4"
          items={[
            { key: 'board', label: '组合看板' },
            { key: 'calc', label: '计算器' },
            { key: 'journal', label: '流水' },
          ]}
        />

        {/* key 随页签切换重挂载：新内容做一次轻淡入，交代"切到哪一页" */}
        <div
          key={mainTab}
          className="animate-[viewFadeIn_0.24s_var(--ease-out-expo)_both]"
        >
        {mainTab === 'board' ? (
          /* Tab 面板切换：新内容统一 small 档淡入上移（grid-tab-panel），与 ink bar 同节奏 */
          <div key="board" className="grid-tab-panel">
            {!persistence.user ? (
              <Card>
                <Empty description="登录后查看组合看板">
                  <Button
                    type="primary"
                    shape="round"
                    onClick={() => persistence.setLoginOpen(true)}
                  >
                    登录
                  </Button>
                </Empty>
              </Card>
            ) : (
              <GridPortfolioBoard
                strategies={boardStrategies}
                trades={tradesApi.trades}
                loading={boardLoading || tradesApi.loading}
                openingStrategyId={openingStrategyId}
                onOpenCalculator={id => {
                  // 等策略结果写入后再切 tab，避免先闪计算器初始页再跳结果页；
                  // 若等待期间用户已手动切走 tab，则尊重用户选择不强切
                  handleOpenStrategy(id, () => {
                    if (mainTabRef.current === 'board') switchMainTab('calc');
                  });
                }}
                onOpenJournal={id => {
                  setJournalStrategyFilter(id);
                  switchMainTab('journal');
                }}
                onEdit={strategy => {
                  setNameModalMode('rename');
                  setRenameTarget(strategy);
                  setNameModalError(null);
                  setNameModalOpen(true);
                }}
              />
            )}
          </div>
        ) : null}

        {mainTab === 'journal' ? (
          <div key="journal" className="grid-tab-panel">
            {!persistence.user ? (
              <div className="grid-card p-4 sm:p-6">
                <Empty description="登录后查看成交流水">
                  <Button
                    type="primary"
                    shape="round"
                    onClick={() => persistence.setLoginOpen(true)}
                  >
                    登录
                  </Button>
                </Empty>
              </div>
            ) : (
              <div className="grid-card p-4 sm:p-6">
                <GridTradeJournal
                  strategies={boardStrategies}
                  trades={tradesApi.trades}
                  strategyId={journalStrategyFilter}
                  onStrategyChange={setJournalStrategyFilter}
                  loadError={tradesApi.error}
                  onRetry={() => void tradesApi.refresh()}
                  loading={tradesApi.loading}
                  onDelete={async id => {
                    // 成败提示由流水组件统一负责（失败保留确认框便于重试），页面不再双重 toast
                    await tradesApi.deleteTrade(id);
                  }}
                />
              </div>
            )}
          </div>
        ) : null}

        {mainTab === 'calc' ? (
          /* 计算器面板容器只在 Tab 切换时淡入；空态↔结果态互换不重播（由结果区入场语言接管） */
          <div key="calc" className="grid-tab-panel">
            {!hasResult ? (
              <>
                <ErrorAlert errors={errors} />
            <ErrorAlert errors={calculationErrors} title="策略生成失败" />

            <div className="grid grid-cols-12 gap-4 sm:gap-8 xl:gap-10">
              <div className="col-span-12 xl:col-span-4">
                <GridParamsPanel
                  {...paramsPanelProps}
                  footer={generateFooter}
                />
              </div>

              <div className="col-span-12 xl:col-span-8">
                <div className="flex min-h-[320px] items-center justify-center rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--card)] px-4 sm:min-h-[480px] sm:px-6 lg:min-h-[520px]">
                  <div className="max-w-sm text-center">
                    <p className="mb-2 text-sm font-medium text-[var(--foreground)]">
                      {calculationErrors.length > 0
                        ? '未能生成有效档位'
                        : '尚无计算结果'}
                    </p>
                    <p className="text-[13px] leading-relaxed text-[var(--muted-foreground)]">
                      {calculationErrors.length > 0
                        ? calculationErrors[0]
                        : '完成左侧参数配置后点击「生成策略」，策略优势推演与明细表格将在此呈现'}
                    </p>
                    {calculationErrors.length > 0 ? (
                      <button
                        type="button"
                        className="mt-4 text-sm font-semibold text-[var(--accent)]"
                        onClick={() => setResult(null)}
                      >
                        返回修改
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
              </>
            ) : (
              <>
            <GridParamsSummaryBar
              basePrice={summaryParams.basePrice}
              minPrice={summaryParams.minPrice}
              amountPerGrid={summaryParams.amountPerGrid}
              gridCount={gridData.length}
              priceDecimals={priceDecimals}
              strategyName={persistence.currentStrategy?.name ?? null}
              draftDirty={draftDirty}
              onEdit={() => setParamsDrawerOpen(true)}
              saveLabel={saveState.label}
              saveDisabled={saveState.disabled}
              saveLoading={persistence.writeLoading}
              saveReason={saveState.reason}
              onSave={handleSaveClick}
            />

            {statusBlocks}

            {/* 结果区：四张卡片带 grid-result-card 标记，供首次生成 stagger 入场选中 */}
            <div className="space-y-8" ref={resultRegionRef}>
              {stressTest ? (
                <div className="grid-result-card">
                  <GridPrimaryKpiRow stressTest={stressTest} />
                </div>
              ) : null}

              <div className="grid grid-cols-1 gap-6 xl:grid-cols-12 xl:gap-8">
                <div className="grid-result-card grid-card flex h-full flex-col p-4 sm:p-6 md:p-8 xl:col-span-7">
                  <LazyStrategyComparisonChart
                    gridData={gridData}
                    basePrice={summaryParams.basePrice}
                    priceDecimals={priceDecimals}
                  />
                </div>

                <div className="grid-result-card grid-card h-full p-4 sm:p-6 md:p-8 xl:col-span-5">
                  <div className="mb-5 border-b border-[var(--border)] pb-4">
                    <h3 className="ds-section-title">资金与收益明细</h3>
                    <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                      资金压力、滚动收益与底仓
                    </p>
                  </div>
                  {stressTest ? (
                    <StatsCards
                      stressTest={stressTest}
                      omitPrimary
                      compact
                    />
                  ) : null}
                </div>
              </div>

              <div className="grid-result-card grid-card p-4 sm:p-6 md:p-8">
                <div className="mb-6 border-b border-[var(--border)] pb-4 sm:mb-8 sm:pb-6">
                  <h3 className="ds-section-title text-lg">网格计算结果</h3>
                  <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                    共 {gridData.length} 个网格档位 · {aggregatedRows.length}{' '}
                    个聚合组
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <GridResultTable
                    aggregatedRows={aggregatedRows}
                    legs={legs}
                    basePrice={summaryParams.basePrice}
                    priceDecimals={priceDecimals}
                    positionQuote={positionQuote}
                    tradeActions={{
                      strategyId: persistence.currentStrategy?.id ?? null,
                      getLevelQty,
                      onTrade: openTrade,
                    }}
                  />
                </div>
              </div>
            </div>

            <Drawer
              title="修改参数"
              open={paramsDrawerOpen}
              onClose={() => setParamsDrawerOpen(false)}
              placement={isMobile ? 'bottom' : 'right'}
              width={isMobile ? undefined : 420}
              height={isMobile ? '90%' : undefined}
              destroyOnHidden={false}
              getContainer={() => shellRef.current ?? document.body}
              rootClassName="grid-params-drawer"
              styles={{
                body: { padding: 16 },
              }}
            >
              <ErrorAlert errors={errors} />
              <GridParamsPanel
                {...paramsPanelProps}
                embedded
                footer={regenerateFooter}
              />
            </Drawer>
              </>
            )}
          </div>
        ) : null}
        </div>
      </div>

      <LoginModal
        open={persistence.loginOpen}
        onClose={() => persistence.setLoginOpen(false)}
        redirectTo={
          typeof window === 'undefined'
            ? '/view/grid'
            : `${window.location.pathname}${window.location.search}`
        }
        title={loginTitle}
        description={loginDescription}
      />

      <GridStrategyLibraryDrawer
        open={persistence.libraryOpen}
        strategies={persistence.strategies}
        currentStrategyId={persistence.currentStrategy?.id ?? null}
        loading={persistence.listLoading}
        error={persistence.listError}
        actionId={persistence.actionId}
        isMobile={isMobile}
        onClose={persistence.closeLibrary}
        onRetry={() => void persistence.openLibrary()}
        onOpenStrategy={handleOpenStrategy}
        onRenameStrategy={strategy => {
          setNameModalMode('rename');
          setRenameTarget(strategy);
          setNameModalError(null);
          setNameModalOpen(true);
        }}
        onDeleteStrategy={handleDeleteStrategy}
      />

      <GridStrategyNameOverlay
        open={nameModalOpen}
        mode={nameModalMode}
        initialName={
          nameModalMode === 'rename' ? renameTarget?.name : undefined
        }
        initialSymbol={
          nameModalMode === 'rename' ? renameTarget?.symbol : undefined
        }
        initialNote={
          nameModalMode === 'rename' ? renameTarget?.note : undefined
        }
        loading={persistence.writeLoading}
        error={nameModalError}
        onCancel={() => setNameModalOpen(false)}
        onSubmit={handleNameSubmit}
      />

      <GridTradeEntryModal
        open={tradeModalOpen}
        loading={tradeSubmitting}
        defaults={tradeDefaults}
        onCancel={() => setTradeModalOpen(false)}
        afterClose={() => setTradeDefaults(null)}
        onSubmit={async values => {
          const strategyId = persistence.currentStrategy?.id;
          if (!strategyId || !tradeDefaults) return;
          setTradeSubmitting(true);
          try {
            await tradesApi.createTrade({
              strategyId,
              levelKey: tradeDefaults.levelKey,
              side: tradeDefaults.side,
              price: values.price,
              qty: values.qty,
              tradeDate: values.tradeDate,
            });
            message.success(
              tradeDefaults.side === 'buy'
                ? '已记录买入（卖出后可再买）'
                : '已记录卖出（可再开一轮）'
            );
            setTradeModalOpen(false);
          } catch (error) {
            message.error(describeError(error, '记账失败，请重试'));
          } finally {
            setTradeSubmitting(false);
          }
        }}
      />
    </div>
  );
}
