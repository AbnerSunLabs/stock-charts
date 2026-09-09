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
import { computeLevelTradeQty } from '@/lib/grid/grid-strategy-trade-stats';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { GridStrategyRepository } from '@/lib/supabase/grid-strategy-repository';
import { DEFAULT_GRID_PARAMS } from '@/types/grid';
import type {
  GridStrategyConfigV1,
  GridStrategyMetadata,
  GridStrategySavePayload,
  SavedGridStrategyV1,
} from '@/types/grid-strategy-storage';
import { App, Button, Card, Drawer, Empty, Grid, Tabs, message } from 'antd';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/**
 * 网格交易策略页（Coinbase 双态布局 + 云端保存）。
 */
export default function GridStrategyPage() {
  return (
    <div className="relative overflow-x-hidden text-[var(--foreground)]">
      <GridAntdProvider>
        <GridStrategyPageInner />
      </GridAntdProvider>
    </div>
  );
}

function GridStrategyPageInner() {
  const { modal } = App.useApp();
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
  const [boardStrategies, setBoardStrategies] = useState<SavedGridStrategyV1[]>(
    []
  );
  const [boardLoading, setBoardLoading] = useState(false);
  const [journalStrategyFilter, setJournalStrategyFilter] = useState<
    string | 'all'
  >('all');
  const [tradeDefaults, setTradeDefaults] =
    useState<GridTradeEntryDefaults | null>(null);
  const [tradeSubmitting, setTradeSubmitting] = useState(false);
  const shellRef = useRef<HTMLElement | null>(null);

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

  const draftDirty = isDraftConfigDirty(draftConfig, generatedConfig);

  const applyOpenedStrategy = useCallback(
    (strategy: SavedGridStrategyV1) => {
      replaceParams(strategy.config.params);
      setDynamicGridEnabled(strategy.config.dynamicGridEnabled);
      setDynamicGridMode(strategy.config.dynamicGridMode);
      setGeneratedConfig(strategy.config);
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
      message.error(error instanceof Error ? error.message : '加载看板失败');
      setBoardStrategies([]);
    } finally {
      setBoardLoading(false);
    }
  }, [persistence.user, strategyRepo]);

  useEffect(() => {
    if (mainTab === 'board' || mainTab === 'journal') {
      void refreshBoardStrategies();
    }
  }, [mainTab, refreshBoardStrategies, persistence.strategies]);

  const currentStrategyTrades = useMemo(() => {
    const id = persistence.currentStrategy?.id;
    if (!id) return [];
    return tradesApi.trades.filter(t => t.strategyId === id);
  }, [persistence.currentStrategy?.id, tradesApi.trades]);

  const getLevelQty = useCallback(
    (levelKey: string) => {
      const list = currentStrategyTrades.filter(t => t.levelKey === levelKey);
      const q = computeLevelTradeQty(list);
      return { openQty: q.openQty, rounds: q.rounds };
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
        qty: side === 'buy' ? leg.buyShares : q.openQty,
        maxSellQty: side === 'sell' ? q.openQty : undefined,
        priceDecimals,
      });
    },
    [getLevelQty, persistence.currentStrategy, priceDecimals, result]
  );

  const hasResult =
    result !== null &&
    result.gridData.length > 0 &&
    result.stressTest !== null &&
    result.calculationErrors.length === 0;

  const saveState = getGridStrategySaveState({
    hasResult,
    hasCloudId: persistence.currentStrategy !== null,
    draftDirty,
    generatedDirty,
  });

  const buildSavePayload = (): GridStrategySavePayload | null => {
    if (!generatedConfig || !result || !hasResult) return null;
    return {
      config: generatedConfig,
      resultSnapshot: result,
    };
  };

  const confirmDiscardIfNeeded = (onConfirm: () => void) => {
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
      content: '当前有未保存的结果或尚未重新生成的参数修改，打开其他策略将覆盖当前页面。',
      okText: '放弃并打开',
      cancelText: '取消',
      onOk: onConfirm,
    });
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
    });
    setGeneratedDirty(true);
    message.success('策略已生成');
    return true;
  };

  const handleGenerateStrategy = () => {
    const ok = applyCalculationResult();
    if (ok) {
      requestAnimationFrame(() => {
        document
          .getElementById('grid-primary-kpis')
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  };

  const handleRegenerate = () => {
    const ok = applyCalculationResult();
    if (ok) {
      setParamsDrawerOpen(false);
      requestAnimationFrame(() => {
        document
          .getElementById('grid-primary-kpis')
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
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
          message.error(error instanceof Error ? error.message : '更新失败');
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

  const handleNameSubmit = async (name: string, symbol: string) => {
    setNameModalError(null);
    try {
      if (nameModalMode === 'rename' && renameTarget) {
        await persistence.renameStrategy(renameTarget.id, name, symbol);
        return;
      }
      const payload = buildSavePayload();
      if (!payload) {
        const err = new Error('当前没有可保存的结果');
        setNameModalError(err.message);
        throw err;
      }
      await persistence.createStrategy(name, { ...payload, symbol });
      setGeneratedDirty(false);
      void tradesApi.refresh();
      void refreshBoardStrategies();
    } catch (error) {
      setNameModalError(error instanceof Error ? error.message : '保存失败');
      throw error;
    }
  };

  const handleOpenStrategy = (id: string) => {
    confirmDiscardIfNeeded(() => {
      void persistence.openStrategy(id).catch(error => {
        message.error(error instanceof Error ? error.message : '打开失败');
      });
    });
  };

  const handleDeleteStrategy = (strategy: GridStrategyMetadata) => {
    modal.confirm({
      title: '删除该策略？',
      content: '只删除该保存记录，不影响其他策略。删除后可在当前页重新保存。',
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
          message.error(error instanceof Error ? error.message : '删除失败');
          throw error;
        }
      },
    });
  };

  const handleSignedOut = () => {
    const wasCloud = persistence.currentStrategy !== null;
    persistence.handleSignedOut();
    if (wasCloud) {
      replaceParams(DEFAULT_GRID_PARAMS);
      setDynamicGridEnabled(false);
      setDynamicGridMode('stable');
      setResult(null);
      setGeneratedConfig(null);
      setGeneratedDirty(false);
      setParamsDrawerOpen(false);
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

  const statusBlocks = (
    <>
      {warnings.length > 0 && hasResult && (
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
      )}

      {strategyState === 'stopped' && (
        <div
          role="status"
          className="mb-4 rounded-[var(--radius-compact)] border border-[var(--loss)] bg-[color-mix(in_srgb,var(--loss)_8%,var(--card))] px-4 py-3 text-sm"
        >
          当前价格已跌破最低价边界。本策略不再自动加码，等待价格回到网格区间或人工重新评估
          basePrice/minPrice。
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
          onChange={key => setMainTab(key as 'calc' | 'board' | 'journal')}
          className="mb-4"
          items={[
            { key: 'calc', label: '计算器' },
            { key: 'board', label: '组合看板' },
            { key: 'journal', label: '流水' },
          ]}
        />

        {mainTab === 'board' ? (
          !persistence.user ? (
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
              onOpenCalculator={id => {
                setMainTab('calc');
                handleOpenStrategy(id);
              }}
              onOpenJournal={id => {
                setJournalStrategyFilter(id);
                setMainTab('journal');
              }}
            />
          )
        ) : null}

        {mainTab === 'journal' ? (
          !persistence.user ? (
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
                initialStrategyId={journalStrategyFilter}
                onDelete={async id => {
                  try {
                    await tradesApi.deleteTrade(id);
                    message.success('已删除');
                  } catch (error) {
                    message.error(
                      error instanceof Error ? error.message : '删除失败'
                    );
                  }
                }}
              />
            </div>
          )
        ) : null}

        {mainTab === 'calc' && !hasResult ? (
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
        ) : mainTab === 'calc' ? (
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

            <div className="space-y-8">
              {stressTest ? <GridPrimaryKpiRow stressTest={stressTest} /> : null}

              <div className="grid grid-cols-1 gap-6 xl:grid-cols-12 xl:gap-8">
                <div className="grid-card flex h-full flex-col p-4 sm:p-6 md:p-8 xl:col-span-7">
                  <LazyStrategyComparisonChart
                    gridData={gridData}
                    basePrice={summaryParams.basePrice}
                    priceDecimals={priceDecimals}
                  />
                </div>

                <div className="grid-card h-full p-4 sm:p-6 md:p-8 xl:col-span-5">
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

              <div className="grid-card p-4 sm:p-6 md:p-8">
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
        ) : null}
      </div>

      <LoginModal
        open={persistence.loginOpen}
        onClose={() => persistence.setLoginOpen(false)}
        redirectTo="/view/grid"
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
        loading={persistence.writeLoading}
        error={nameModalError}
        onCancel={() => setNameModalOpen(false)}
        onSubmit={handleNameSubmit}
      />

      <GridTradeEntryModal
        open={tradeDefaults !== null}
        loading={tradeSubmitting}
        defaults={tradeDefaults}
        onCancel={() => setTradeDefaults(null)}
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
            setTradeDefaults(null);
          } catch (error) {
            message.error(error instanceof Error ? error.message : '记账失败');
          } finally {
            setTradeSubmitting(false);
          }
        }}
      />
    </div>
  );
}
