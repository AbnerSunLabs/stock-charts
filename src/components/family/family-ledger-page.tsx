'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  App,
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Table,
  Empty,
  Tooltip,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { FamilyFinanceRepository } from '@/lib/supabase/family-finance-repository';
import {
  ASSET_CATEGORIES,
  LIABILITY_CATEGORIES,
  CATEGORY_LABELS,
  FOUR_POT_LABELS,
  STRUCTURE_FOUR_POTS,
  type FamilyLedgerItem,
  type FamilyAssetHistory,
  type FamilyMember,
  type FourPot,
  type LedgerCategory,
  type LedgerSide,
  type StructureFourPot,
} from '@/types/family-finance';
import {
  computeFourPotShares,
  computeLedgerTotals,
  roundMoney,
} from '@/lib/family-finance/aggregates';
import { formatCny, formatDateTime } from '@/lib/family-finance/format';
import { listTransferTargetOptions } from '@/lib/family-finance/ledger-transfer';
import { FamilyAmountVisibilityProvider } from '@/components/family/family-amount-visibility';
import { FamilyAmountVisibilityButton } from '@/components/family/family-amount-visibility-toggle';
import { FamilyAmountText } from '@/components/family/family-amount-text';
import {
  FamilyFormDisclosure,
  FamilyMotionStyles,
  useFamilyRowFadeRemoval,
} from '@/components/family/family-motion';
import { FamilyAssetStructurePie } from '@/components/family/family-asset-structure-pie';
import { FamilyAssetHistoryLine } from '@/components/family/family-asset-history-line';
import { buildFamilyAssetHistory } from '@/lib/family-finance/history';

/**
 * 家庭资产记账主界面。
 */
export function FamilyLedgerPage() {
  const { message, modal } = App.useApp();
  const repo = useMemo(() => new FamilyFinanceRepository(createBrowserSupabaseClient()), []);

  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [items, setItems] = useState<FamilyLedgerItem[]>([]);
  const [assetHistory, setAssetHistory] =
    useState<FamilyAssetHistory>([]);
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [itemSaving, setItemSaving] = useState(false);
  const itemSavingRef = useRef(false);
  const [editing, setEditing] = useState<FamilyLedgerItem | null>(null);
  /** 资产表：四笔钱筛选（仅活钱/稳钱/长钱）；null 表示全部 */
  const [assetFourPotFilter, setAssetFourPotFilter] = useState<StructureFourPot | null>(null);
  /** 资产表：成员筛选；null 表示全部 */
  const [assetMemberFilter, setAssetMemberFilter] = useState<string | null>(null);
  /** 筛选切换后资产表容器重放一次 small 档淡切（高频操作，纯淡切不抢戏） */
  const [assetTableFading, setAssetTableFading] = useState(false);
  /** 金额默认隐藏；每次进入页面重置，不持久化。 */
  const [amountsVisible, setAmountsVisible] = useState(false);
  /** 首屏加载完成后，后续增删改一律静默刷新（不再整页骨架闪一遍） */
  const loadedOnceRef = useRef(false);
  const { removingIds, fadeOutRow, settleRemovals } = useFamilyRowFadeRemoval();
  const [form] = Form.useForm();
  const sideWatch: LedgerSide = Form.useWatch('side', form) ?? 'asset';
  const transferToIdWatch: string | undefined = Form.useWatch('transferToId', form);
  const transferAmountWatch: number | undefined = Form.useWatch('transferAmount', form);
  const isTransferring = Boolean(
    editing && sideWatch === 'asset' && transferToIdWatch
  );
  const amountAfterTransfer =
    editing != null && isTransferring
      ? roundMoney(editing.amount - roundMoney(transferAmountWatch ?? 0))
      : null;
  const transferToExtra =
    amountAfterTransfer == null
      ? undefined
      : amountAfterTransfer < 0
        ? '转移金额不能超过当前余额'
        : amountAfterTransfer === 0
          ? '转移后本条目余额为 0，转空后仍保留本条目'
          : `转移后本条目余额 ${formatCny(amountAfterTransfer)}`;

  const reload = useCallback(async () => {
    // 状态变化：首屏加载 → 全页骨架；保存/删除等后续刷新 → 静默更新（按钮自有 confirmLoading）
    const silent = loadedOnceRef.current;
    if (!silent) setLoading(true);
    try {
      await repo.ensureSelfMember();
      const [m, i, historyRows] = await Promise.all([
        repo.listMembers(),
        repo.listLedgerItems(),
        repo.listAssetHistory(),
      ]);
      setMembers(m);
      setItems(i);
      setAssetHistory(buildFamilyAssetHistory(historyRows));
    } catch (e) {
      const reason = e instanceof Error ? e.message : '加载失败';
      // 静默刷新失败：保留旧数据（回滚提示），明确告知当前展示的是最近一次数据
      message.error(silent ? `数据刷新失败，当前展示的是最近一次数据（${reason}）` : reason);
    } finally {
      loadedOnceRef.current = true;
      if (!silent) setLoading(false);
      // 刷新落定后清算删除淡出标记：失败时旧数据仍在的行恢复可见，杜绝幽灵行
      settleRemovals();
    }
  }, [repo, message, settleRemovals]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const totals = useMemo(() => computeLedgerTotals(items), [items]);
  const fourPotShares = useMemo(() => computeFourPotShares(items), [items]);
  const memberNameById = useMemo(
    () => new Map(members.map(m => [m.id, m.name])),
    [members]
  );
  const assetItems = useMemo(() => items.filter(i => i.side === 'asset'), [items]);
  const filteredAssetItems = useMemo(() => {
    return assetItems.filter(item => {
      if (assetFourPotFilter != null && item.fourPot !== assetFourPotFilter) return false;
      if (assetMemberFilter != null && item.memberId !== assetMemberFilter) return false;
      return true;
    });
  }, [assetItems, assetFourPotFilter, assetMemberFilter]);
  const liabilityItems = useMemo(
    () => items.filter(i => i.side === 'liability'),
    [items]
  );

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({
      side: 'asset',
      category: 'cash',
      amount: 0,
      memberId: members.find(m => m.role === 'self')?.id,
      transferToId: undefined,
      transferAmount: undefined,
    });
    setItemModalOpen(true);
  };

  const openEdit = (row: FamilyLedgerItem) => {
    setEditing(row);
    form.setFieldsValue({
      side: row.side,
      category: row.category,
      name: row.name,
      amount: row.amount,
      memberId: row.memberId,
      // 保险（资金标签）已下线：编辑时清空，需改选活钱/稳钱/长钱
      fourPot: row.fourPot === 'insurance' ? undefined : row.fourPot,
      note: row.note,
      transferToId: undefined,
      transferAmount: undefined,
    });
    setItemModalOpen(true);
  };

  const transferTargetOptions = useMemo(() => {
    if (!editing) return [];
    return listTransferTargetOptions({
      items,
      members,
      sourceId: editing.id,
    });
  }, [editing, items, members]);

  const saveItem = async () => {
    // 同步锁：避免 validateFields 完成前连点并行进入
    if (itemSavingRef.current) {
      throw new Error('正在保存');
    }
    itemSavingRef.current = true;
    setItemSaving(true);
    let transferCommitted = false;
    try {
      const values = await form.validateFields();
      let amount = values.amount as number;
      const willTransfer =
        editing != null &&
        values.side === 'asset' &&
        typeof values.transferToId === 'string' &&
        values.transferToId.length > 0 &&
        editing.amount > 0;

      if (willTransfer && editing) {
        const transferred = await repo.transferLedgerAmount({
          fromId: editing.id,
          toId: values.transferToId,
          amount: values.transferAmount,
        });
        transferCommitted = true;
        // 金额以转移结果为准；源可为 0 且保留条目
        amount = transferred.source.amount;
        // 转移已落库：立刻清空转移表单并同步本地余额，避免 upsert 失败后重试二次扣款
        setEditing(prev =>
          prev && prev.id === transferred.source.id
            ? { ...prev, amount: transferred.source.amount }
            : prev
        );
        form.setFieldsValue({
          transferToId: undefined,
          transferAmount: undefined,
          amount: transferred.source.amount,
        });
        // 同步列表，避免关闭弹窗后仍显示转移前余额
        setItems(prev =>
          prev.map(item => {
            if (item.id === transferred.source.id) return transferred.source;
            if (item.id === transferred.target.id) return transferred.target;
            return item;
          })
        );
      }

      await repo.upsertLedgerItem({
        id: editing?.id,
        side: values.side,
        category: values.category,
        name: values.name,
        amount,
        memberId: values.side === 'asset' ? values.memberId : null,
        fourPot: values.side === 'asset' ? (values.fourPot ?? null) : null,
        note: values.note ?? null,
      });
      message.success(
        willTransfer ? '已转移并更新条目' : editing ? '已更新条目' : '已添加条目'
      );
      setItemModalOpen(false);
      await reload();
    } catch (e) {
      // 校验失败：不 toast，rethrow 让 Modal 保持打开
      if (e && typeof e === 'object' && 'errorFields' in e) {
        throw e;
      }
      // 转移已提交时刷新列表，避免关闭弹窗后看到过期余额；
      // rethrow 让 Modal 保持打开，用户重试时只提交条目信息（转移输入已清空）
      if (transferCommitted) {
        void reload();
        message.error('余额转移已完成，条目信息未保存，请重试保存');
        throw e instanceof Error ? e : new Error('条目信息未保存');
      }
      message.error(describeError(e, '保存失败，请重试'));
      throw e instanceof Error ? e : new Error('保存失败');
    } finally {
      itemSavingRef.current = false;
      setItemSaving(false);
    }
  };

  const categoryOptions: Array<{ value: LedgerCategory; label: string }> =
    sideWatch === 'asset'
      ? ASSET_CATEGORIES.map(c => ({ value: c, label: CATEGORY_LABELS[c] }))
      : LIABILITY_CATEGORIES.map(c => ({ value: c, label: CATEGORY_LABELS[c] }));

  const buildColumns = (side: LedgerSide): ColumnsType<FamilyLedgerItem> => {
    const cols: ColumnsType<FamilyLedgerItem> = [
      {
        title: '名称',
        dataIndex: 'name',
        ellipsis: { showTitle: false },
        render: (name: string) => (
          <Tooltip placement="topLeft" title={name}>
            <span>{name}</span>
          </Tooltip>
        ),
      },
      {
        title: '分类',
        dataIndex: 'category',
        render: (c: LedgerCategory) => CATEGORY_LABELS[c],
      },
    ];
    if (side === 'asset') {
      cols.push(
        {
          title: '成员',
          dataIndex: 'memberId',
          ellipsis: { showTitle: false },
          render: (id: string | null) => {
            const label = memberNameById.get(id ?? '') ?? '—';
            return (
              <Tooltip placement="topLeft" title={label}>
                <span>{label}</span>
              </Tooltip>
            );
          },
        },
        {
          title: '四笔钱',
          dataIndex: 'fourPot',
          render: (fourPot: FourPot | null) =>
            fourPot ? FOUR_POT_LABELS[fourPot] : '—',
        }
      );
    }
    cols.push(
      {
        title: '金额',
        dataIndex: 'amount',
        align: 'right',
        /* 状态变化：金额显隐切换——同宽掩码 + blur/opacity 淡切，列宽不抖 */
        render: (v: number) => (
          <FamilyAmountText amount={v} className="family-finance-monetary-value" />
        ),
      },
      {
        title: '创建时间',
        dataIndex: 'createdAt',
        width: 150,
        ellipsis: { showTitle: false },
        render: (iso: string) => {
          const label = formatDateTime(iso);
          return (
            <Tooltip placement="topLeft" title={label}>
              <span>{label}</span>
            </Tooltip>
          );
        },
      },
      {
        title: '更新时间',
        dataIndex: 'updatedAt',
        width: 150,
        ellipsis: { showTitle: false },
        render: (iso: string) => {
          const label = formatDateTime(iso);
          return (
            <Tooltip placement="topLeft" title={label}>
              <span>{label}</span>
            </Tooltip>
          );
        },
      },
      {
        title: '操作',
        width: 140,
        render: (_, row) => (
          <Space size="small">
            <Button type="link" size="small" onClick={() => openEdit(row)}>
              编辑
            </Button>
            <Button
              type="link"
              size="small"
              danger
              onClick={() => {
                modal.confirm({
                  title: `删除条目「${row.name}」？`,
                  content: '该条目将从账本移除，资产或负债合计随之更新。',
                  okText: '删除',
                  okButtonProps: { danger: true },
                  cancelText: '取消',
                  onOk: async () => {
                    // 状态变化：删除确认成功 → 该行先淡出（exit-small）再静默刷新数据
                    await repo.deleteLedgerItem(row.id);
                    message.success('已删除该条流水');
                    await fadeOutRow(row.id);
                    await reload();
                  },
                });
              }}
            >
              删除
            </Button>
          </Space>
        ),
      }
    );
    return cols;
  };

  return (
    <FamilyAmountVisibilityProvider value={amountsVisible}>
      {/* 状态变化：页面首次进入 —— 根容器统一 motion-enter（规范 token） */}
      <div className="family-finance-page family-ledger-page space-y-6 motion-enter">
      <FamilyMotionStyles />
      <header className="family-finance-header">
        <div>
          <div className="family-finance-eyebrow">资产记账</div>
          <div className="family-finance-header__title-row">
            <h1>家庭资产记账</h1>
            {/* 状态变化：金额显隐切换——图标叠层 crossfade，图表与文本金额统一淡切 */}
            <FamilyAmountVisibilityButton onToggle={() => setAmountsVisible(v => !v)} />
          </div>
          <p>维护成员资产和家庭负债，保存后会同步更新家庭财务总览。</p>
        </div>
        <Button
          type="primary"
          size="large"
          className="family-finance-primary-action"
          onClick={openCreate}
        >
          + 添加资产/负债
        </Button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="family-finance-section-card family-ledger-structure-card">
          <div>
            <div className="family-finance-section__eyebrow">资产配置</div>
            <h2 className="family-finance-section__title">资产结构</h2>
            <p className="family-finance-section__description">
              按活钱、稳钱和长钱查看当前资产分布。
            </p>
          </div>
          <div className="flex flex-1 items-center justify-center w-full">
            {/* 状态变化：首屏加载 → 同高骨架（先骨架后内容，禁止先闪空态）；空态↔图表互切 small 档淡入 */}
            {loading && fourPotShares.length === 0 ? (
              <div
                className="motion-skeleton h-[320px] w-full max-w-[600px] rounded-lg"
                role="status"
                aria-label="正在加载资产结构…"
              />
            ) : fourPotShares.length === 0 ? (
              <div
                key="structure-empty"
                style={{
                  animationName: 'viewFadeIn',
                  animationDuration: 'var(--motion-duration-small)',
                  animationTimingFunction: 'var(--motion-ease-out)',
                }}
              >
                <Empty description="还没有活钱/稳钱/长钱标注的资产" />
              </div>
            ) : (
              <div
                key="structure-chart"
                className="w-full max-w-[600px]"
                style={{
                  animationName: 'viewFadeIn',
                  animationDuration: 'var(--motion-duration-small)',
                  animationTimingFunction: 'var(--motion-ease-out)',
                }}
              >
                <FamilyAssetStructurePie
                  shares={fourPotShares}
                  totalAssets={totals.totalAssets}
                  height={320}
                />
              </div>
            )}
          </div>
        </Card>

        <Card className="family-finance-section-card family-ledger-items-card">
          <div>
            <div className="family-finance-section__eyebrow">账本明细</div>
            <h2 className="family-finance-section__title">条目列表</h2>
            <p className="family-finance-section__description">
              资产与负债会分别展示，便于核对家庭账本。
            </p>
          </div>
          <div className="family-finance-section__content space-y-4">
            <div>
              <div className="family-ledger-table-toolbar">
                <h3 className="family-ledger-table-title">资产</h3>
                <Space wrap size="small" className="family-ledger-asset-filters">
                  <Select
                    allowClear
                    placeholder="四笔钱"
                    value={assetFourPotFilter ?? undefined}
                    onChange={(v: StructureFourPot | undefined) => {
                      setAssetFourPotFilter(v ?? null);
                      setAssetTableFading(true);
                    }}
                    options={STRUCTURE_FOUR_POTS.map(k => ({
                      value: k,
                      label: FOUR_POT_LABELS[k],
                    }))}
                    className="family-ledger-filter-select"
                    aria-label="按四笔钱筛选资产"
                  />
                  <Select
                    allowClear
                    placeholder="家庭成员"
                    value={assetMemberFilter ?? undefined}
                    onChange={(v: string | undefined) => {
                      setAssetMemberFilter(v ?? null);
                      setAssetTableFading(true);
                    }}
                    options={members.map(m => ({ value: m.id, label: m.name }))}
                    className="family-ledger-filter-select"
                    aria-label="按家庭成员筛选资产"
                  />
                </Space>
              </div>
              {/* 状态变化：筛选切换 → 行集合替换，容器重放一次 small 档纯淡切（表格本体不重挂载） */}
              <div
                className={assetTableFading ? 'family-table-swap-fade' : undefined}
                onAnimationEnd={() => setAssetTableFading(false)}
              >
                <Table
                  size="small"
                  loading={loading}
                  rowKey="id"
                  pagination={{ pageSize: 6 }}
                  scroll={{ x: 'max-content' }}
                  dataSource={filteredAssetItems}
                  columns={buildColumns('asset')}
                  rowClassName={record =>
                    removingIds.has(record.id) ? 'family-row-removing' : ''
                  }
                  locale={{
                    emptyText:
                      assetItems.length === 0
                        ? '暂无资产条目'
                        : '无匹配的资产条目',
                  }}
                />
              </div>
            </div>
            <div>
              <h3 className="family-ledger-table-title">负债</h3>
              <Table
                size="small"
                loading={loading}
                rowKey="id"
                pagination={{ pageSize: 6 }}
                scroll={{ x: 'max-content' }}
                dataSource={liabilityItems}
                columns={buildColumns('liability')}
                rowClassName={record =>
                  removingIds.has(record.id) ? 'family-row-removing' : ''
                }
                locale={{ emptyText: '暂无负债条目' }}
              />
            </div>
          </div>
        </Card>
      </div>

      <section className="space-y-4">
        <div>
          <div className="family-finance-section__eyebrow">成员资产</div>
          <h2 className="family-finance-section__title">成员资产变动</h2>
          <p className="family-finance-section__description">
            每次保存条目都会刷新当天快照，分别跟踪活钱、稳钱和长钱
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* 状态变化：首屏加载 → 成员历史区同高骨架（先骨架后内容，避免区块凭空出现） */}
          {loading && assetHistory.length === 0
            ? [0, 1].map(i => (
                <div
                  key={`history-skeleton-${i}`}
                  className="motion-skeleton h-[350px] rounded-xl"
                  role="status"
                  aria-label="正在加载成员资产变动…"
                />
              ))
            : assetHistory.map(series => (
                <FamilyAssetHistoryLine
                  key={series.memberId}
                  title={`${series.memberName}的资产`}
                  points={series.points}
                />
              ))}
        </div>
      </section>

      <Modal
        title={editing ? '编辑条目' : '添加条目'}
        open={itemModalOpen}
        width={640}
        onCancel={() => {
          if (itemSavingRef.current) return;
          setItemModalOpen(false);
        }}
        onOk={() => saveItem()}
        confirmLoading={itemSaving}
        okButtonProps={{ disabled: itemSaving }}
        okText={itemSaving ? '保存中…' : '保存'}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" className="mt-2">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="side" label="类型" rules={[{ required: true }]}>
                <Select
                  options={[
                    { value: 'asset', label: '资产' },
                    { value: 'liability', label: '负债' },
                  ]}
                  onChange={(side: LedgerSide) => {
                    form.setFieldsValue({
                      category: side === 'asset' ? 'cash' : 'mortgage',
                      memberId:
                        side === 'asset'
                          ? members.find(m => m.role === 'self')?.id ?? null
                          : null,
                      fourPot: null,
                      transferToId: undefined,
                      transferAmount: undefined,
                    });
                  }}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="category" label="分类" rules={[{ required: true }]}>
                <Select options={categoryOptions} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="name"
                label="名称"
                rules={[{ required: true, message: '请输入名称' }]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="amount"
                label="金额"
                rules={[{ required: true, message: '请输入金额' }]}
              >
                <InputNumber
                  min={0}
                  precision={2}
                  disabled={isTransferring}
                  className="w-full min-w-[10rem]"
                  style={{ width: '100%', minWidth: '10rem' }}
                />
              </Form.Item>
            </Col>
            {/* 状态变化：类型切到「资产」→ 成员/四笔钱字段 0fr→1fr 展开并淡入，避免 Modal 高度跳变。
                字段常挂（收起时 visibility 移出可访问性树），校验规则随可见性启停，负债保存不被隐藏字段拦截 */}
            <Col span={24}>
              <FamilyFormDisclosure visible={sideWatch === 'asset'}>
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item
                      name="memberId"
                      label="成员"
                      rules={
                        sideWatch === 'asset'
                          ? [{ required: true, message: '资产必须选择成员' }]
                          : []
                      }
                    >
                      <Select options={members.map(m => ({ value: m.id, label: m.name }))} />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item
                      name="fourPot"
                      label="四笔钱"
                      rules={
                        sideWatch === 'asset'
                          ? [{ required: true, message: '请选择四笔钱分类' }]
                          : []
                      }
                    >
                      <Select
                        allowClear
                        options={STRUCTURE_FOUR_POTS.map(k => ({
                          value: k,
                          label: FOUR_POT_LABELS[k],
                        }))}
                      />
                    </Form.Item>
                  </Col>
                </Row>
              </FamilyFormDisclosure>
            </Col>
            {/* 状态变化：编辑资产且余额 > 0 → 「转移至/转移金额」区块展开；选择目标后金额输入再展开 */}
            <Col span={24}>
              <FamilyFormDisclosure
                visible={Boolean(editing && sideWatch === 'asset' && editing.amount > 0)}
              >
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item
                      name="transferToId"
                      label="转移至"
                      extra={transferToExtra}
                    >
                      <Select
                        allowClear
                        showSearch
                        optionFilterProp="label"
                        placeholder="不转移"
                        options={transferTargetOptions}
                        onChange={() => {
                          form.setFieldsValue({ transferAmount: undefined });
                        }}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <FamilyFormDisclosure visible={Boolean(transferToIdWatch)}>
                      <Form.Item
                        name="transferAmount"
                        label="转移金额"
                        rules={
                          /* 与区块显隐同门控：类型切到负债时字段隐藏，校验必须同步停用，
                             不能只依赖 side onChange 清值（防御未来路径绕过） */
                          sideWatch === 'asset' && transferToIdWatch
                            ? [
                                { required: true, message: '请输入转移金额' },
                                {
                                  validator: async (_, value: number | null | undefined) => {
                                    const n = roundMoney(value ?? 0);
                                    if (!(n > 0)) {
                                      throw new Error('转移金额必须大于 0');
                                    }
                                    if (editing && n > editing.amount) {
                                      throw new Error('转移金额不能超过当前余额');
                                    }
                                  },
                                },
                              ]
                            : []
                        }
                      >
                        <InputNumber
                          min={0.01}
                          max={editing?.amount}
                          precision={2}
                          className="w-full min-w-[10rem]"
                          style={{ width: '100%', minWidth: '10rem' }}
                          placeholder={editing ? `最多 ${formatCny(editing.amount)}` : undefined}
                        />
                      </Form.Item>
                    </FamilyFormDisclosure>
                  </Col>
                </Row>
              </FamilyFormDisclosure>
            </Col>
            <Col span={24}>
              <Form.Item name="note" label="备注">
                <Input.TextArea rows={2} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
      </div>
    </FamilyAmountVisibilityProvider>
  );
}
