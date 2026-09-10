'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EyeFilled, EyeInvisibleFilled } from '@ant-design/icons';
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
  /** 金额默认隐藏；每次进入页面重置，不持久化。 */
  const [amountsVisible, setAmountsVisible] = useState(false);
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
    setLoading(true);
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
      message.error(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [repo, message]);

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
        willTransfer ? '已转移并更新' : editing ? '已更新' : '已添加'
      );
      setItemModalOpen(false);
      await reload();
    } catch (e) {
      // 校验失败：不 toast，rethrow 让 Modal 保持打开
      if (e && typeof e === 'object' && 'errorFields' in e) {
        throw e;
      }
      // 转移已提交时刷新列表，避免关闭弹窗后看到过期余额
      if (transferCommitted) {
        void reload();
      }
      message.error(e instanceof Error ? e.message : '保存失败');
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
        render: (v: number) => (
          <span className="family-finance-monetary-value">
            {formatCny(v, { visible: amountsVisible })}
          </span>
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
                  title: '删除该条目？',
                  onOk: async () => {
                    await repo.deleteLedgerItem(row.id);
                    message.success('已删除');
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
      <div className="family-finance-page family-ledger-page space-y-6">
      <header className="family-finance-header">
        <div>
          <div className="family-finance-eyebrow">资产记账</div>
          <div className="family-finance-header__title-row">
            <h1>家庭资产记账</h1>
            <button
              type="button"
              className="family-amount-visibility-toggle"
              aria-label={amountsVisible ? '隐藏金额' : '显示金额'}
              aria-pressed={amountsVisible}
              onClick={() => setAmountsVisible(v => !v)}
            >
              {amountsVisible ? <EyeFilled /> : <EyeInvisibleFilled />}
            </button>
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
            {fourPotShares.length === 0 ? (
              <Empty description="暂无活钱/稳钱/长钱标注资产" />
            ) : (
              <div className="w-full max-w-[600px]">
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
                    onChange={(v: StructureFourPot | undefined) =>
                      setAssetFourPotFilter(v ?? null)
                    }
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
                    onChange={(v: string | undefined) => setAssetMemberFilter(v ?? null)}
                    options={members.map(m => ({ value: m.id, label: m.name }))}
                    className="family-ledger-filter-select"
                    aria-label="按家庭成员筛选资产"
                  />
                </Space>
              </div>
              <Table
                size="small"
                loading={loading}
                rowKey="id"
                pagination={{ pageSize: 6 }}
                scroll={{ x: 'max-content' }}
                dataSource={filteredAssetItems}
                columns={buildColumns('asset')}
                locale={{
                  emptyText:
                    assetItems.length === 0
                      ? '暂无资产条目'
                      : '无匹配的资产条目',
                }}
              />
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
          {assetHistory.map(series => (
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
            {sideWatch === 'asset' && (
              <>
                <Col span={12}>
                  <Form.Item
                    name="memberId"
                    label="成员"
                    rules={[{ required: true, message: '资产必须选择成员' }]}
                  >
                    <Select options={members.map(m => ({ value: m.id, label: m.name }))} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="fourPot"
                    label="四笔钱"
                    rules={[{ required: true, message: '请选择四笔钱分类' }]}
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
              </>
            )}
            {editing && sideWatch === 'asset' && editing.amount > 0 && (
              <>
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
                {transferToIdWatch ? (
                  <Col span={12}>
                    <Form.Item
                      name="transferAmount"
                      label="转移金额"
                      rules={[
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
                      ]}
                    >
                      <InputNumber
                        min={0.01}
                        max={editing.amount}
                        precision={2}
                        className="w-full min-w-[10rem]"
                        style={{ width: '100%', minWidth: '10rem' }}
                        placeholder={`最多 ${formatCny(editing.amount)}`}
                      />
                    </Form.Item>
                  </Col>
                ) : null}
              </>
            )}
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
