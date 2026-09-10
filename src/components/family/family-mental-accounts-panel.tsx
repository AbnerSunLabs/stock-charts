'use client';

import { useMemo, useRef, useState } from 'react';
import {
  App,
  Button,
  Card,
  Col,
  DatePicker,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Switch,
  Tooltip,
} from 'antd';
import dayjs, { type Dayjs } from '@/lib/antd-dayjs';
import type { FamilyFinanceRepository } from '@/lib/supabase/family-finance-repository';
import {
  aggregateMentalGoalsByPriority,
  compareMentalAccountPace,
  computeMentalAccountProgress,
  computeMentalAccountTimeProgress,
  groupMentalAccountsByPriority,
  listSelectableMentalLedgerItems,
  type MentalPaceStatus,
} from '@/lib/family-finance/mental-account';
import type {
  FamilyLedgerItem,
  FamilyMember,
  FamilyMentalAccount,
  MentalAccountPriority,
} from '@/types/family-finance';
import { MENTAL_ACCOUNT_PRIORITIES } from '@/types/family-finance';
import { isStructureFourPot } from '@/lib/family-finance/aggregates';
import { FamilyMentalAccountLiquid } from '@/components/family/family-mental-account-liquid';
import { FamilyMentalGoalsBarChart } from '@/components/family/family-mental-goals-bar-chart';
import Link from 'next/link';
import { CloseOutlined, EditOutlined, QuestionCircleOutlined } from '@ant-design/icons';

interface FamilyMentalAccountsPanelProps {
  repo: FamilyFinanceRepository;
  loading: boolean;
  items: FamilyLedgerItem[];
  members: FamilyMember[];
  accounts: FamilyMentalAccount[];
  onChanged: () => Promise<void>;
}

interface MentalAccountFormValues {
  name: string;
  targetAmount: number;
  priority: MentalAccountPriority;
  startDate: Dayjs;
  targetDate: Dayjs;
  ledgerItemIds: string[];
  showLinkedAccounts: boolean;
}

const PRIORITY_OPTIONS = MENTAL_ACCOUNT_PRIORITIES.map(value => ({
  value,
  label: value,
}));

/** 鼓励文案按进度对比态区分色。 */
const PACE_MESSAGE_CLASS: Record<MentalPaceStatus, string> = {
  ahead:
    'bg-[var(--success-soft)] text-[var(--success)] ring-1 ring-[color-mix(in_srgb,var(--success)_28%,transparent)]',
  behind:
    'bg-[var(--gold-soft)] text-[color-mix(in_srgb,var(--gold)_82%,#9a3412)] ring-1 ring-[color-mix(in_srgb,var(--gold)_35%,transparent)]',
  on_track:
    'bg-[var(--accent-soft)] text-[var(--text-accent)] ring-1 ring-[color-mix(in_srgb,var(--accent)_28%,transparent)]',
};

/** 鼓励文案展示逻辑说明（问号 Tooltip）。 */
const PACE_LOGIC_HELP = (
  <div className="max-w-[260px] space-y-1.5 text-xs leading-relaxed">
    <p className="m-0 font-medium">按存款进度与时间进度对比（百分号保留两位）：</p>
    <ul className="m-0 list-disc space-y-0.5 pl-4">
      <li>存款 &gt; 时间 → 你们好棒棒</li>
      <li>存款 &lt; 时间 → 需要抓紧存钱啦</li>
      <li>相等 → 继续保持哦</li>
    </ul>
    <p className="m-0 text-white/80">
      时间进度 = (今天 − 开始日) ÷ (预期达成 − 开始日)，夹在 0%～100%；存款进度为当前金额相对目标的完成比例（不超过
      100%）。
    </p>
  </div>
);

/**
 * 总览心理账户区：左分组瀑布流 + 右目标柱状图 + 添加/编辑弹窗。
 */
export function FamilyMentalAccountsPanel({
  repo,
  loading,
  items,
  members,
  accounts,
  onChanged,
}: FamilyMentalAccountsPanelProps) {
  const { message, modal } = App.useApp();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<FamilyMentalAccount | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [form] = Form.useForm<MentalAccountFormValues>();

  const selectable = useMemo(
    () =>
      listSelectableMentalLedgerItems({
        items,
        members,
        allAccounts: accounts,
        editingAccountId: editing?.id ?? null,
      }),
    [items, members, accounts, editing]
  );

  const priorityGroups = useMemo(
    () => groupMentalAccountsByPriority(accounts),
    [accounts]
  );

  const goalAggregates = useMemo(
    () => aggregateMentalGoalsByPriority(accounts, items),
    [accounts, items]
  );

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({
      priority: 'P1',
      startDate: dayjs(),
      ledgerItemIds: [],
      showLinkedAccounts: true,
    });
    setOpen(true);
  };

  const openEdit = (account: FamilyMentalAccount) => {
    setEditing(account);
    const options = listSelectableMentalLedgerItems({
      items,
      members,
      allAccounts: accounts,
      editingAccountId: account.id,
    });
    const validIds = new Set(options.map(o => o.id));
    form.setFieldsValue({
      name: account.name,
      targetAmount: account.targetAmount,
      priority: account.priority,
      startDate: dayjs(account.startDate),
      targetDate: dayjs(account.targetDate),
      ledgerItemIds: account.ledgerItemIds.filter(id => validIds.has(id)),
      showLinkedAccounts: account.showLinkedAccounts,
    });
    setOpen(true);
  };

  const save = async () => {
    if (savingRef.current) return;
    const values = await form.validateFields();
    savingRef.current = true;
    setSaving(true);
    try {
      await repo.upsertMentalAccount({
        id: editing?.id,
        name: values.name,
        targetAmount: values.targetAmount,
        priority: values.priority,
        startDate: values.startDate.format('YYYY-MM-DD'),
        targetDate: values.targetDate.format('YYYY-MM-DD'),
        ledgerItemIds: values.ledgerItemIds,
        showLinkedAccounts: values.showLinkedAccounts ?? true,
      });
      message.success(editing ? '已更新心理账户' : '已添加心理账户');
      setOpen(false);
      await onChanged();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '保存失败');
      throw e;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const remove = (account: FamilyMentalAccount) => {
    let deleted = false;
    modal.confirm({
      title: `删除心理账户「${account.name}」？`,
      content: '不会删除关联的活账条目。',
      okType: 'danger',
      onOk: async () => {
        try {
          await repo.deleteMentalAccount(account.id);
          deleted = true;
        } catch (e) {
          message.error(e instanceof Error ? e.message : '删除失败');
          throw e;
        }
      },
      afterClose: () => {
        if (!deleted) return;
        message.success('已删除');
        void onChanged();
      },
    });
  };

  return (
    <>
      <Row gutter={[16, 16]} className="family-mental-accounts-layout">
        <Col xs={24} lg={16}>
          <Card
            className="family-finance-section-card family-mental-accounts-card"
            title={<h2 className="family-finance-section__title">心理账户</h2>}
            loading={loading}
            extra={
              <Button type="primary" size="small" onClick={openCreate}>
                添加心理账户
              </Button>
            }
          >
            {accounts.length === 0 ? (
              <Empty description="尚未设立心理账户" />
            ) : (
              <div className="family-mental-accounts-groups">
                {priorityGroups.map(group => (
                  <section
                    key={group.priority}
                    className="family-mental-accounts-group"
                    aria-label={`${group.priority} 心理账户`}
                  >
                    <header className="family-mental-accounts-group__header">
                      <span className="family-mental-accounts-group__title">
                        {group.priority}
                      </span>
                      <span className="family-mental-accounts-group__count">
                        {group.accounts.length} 个
                      </span>
                    </header>
                    <div className="family-mental-accounts-waterfall">
                      {group.accounts.map(account => {
                        const progress = computeMentalAccountProgress(account, items);
                        const linkedAccountNames = account.ledgerItemIds.flatMap(id => {
                          const item = items.find(i => i.id === id);
                          if (
                            !item ||
                            item.side !== 'asset' ||
                            !isStructureFourPot(item.fourPot)
                          ) {
                            return [];
                          }
                          return [item.name];
                        });
                        const hasValidLink = linkedAccountNames.length > 0;
                        const pace = compareMentalAccountPace(
                          progress.chartPercent,
                          computeMentalAccountTimeProgress(account.startDate, account.targetDate)
                        );
                        return (
                          <div key={account.id} className="family-mental-account-item">
                            <div className="mb-2">
                              <div className="flex items-start justify-between gap-2">
                                <Tooltip title={account.name}>
                                  <div className="min-w-0 flex-1 truncate font-medium">
                                    {account.name}
                                  </div>
                                </Tooltip>
                                <Space size="small">
                                  <Button
                                    type="text"
                                    size="small"
                                    icon={<EditOutlined />}
                                    aria-label="编辑"
                                    onClick={() => openEdit(account)}
                                  />
                                  <Button
                                    type="text"
                                    size="small"
                                    danger
                                    icon={<CloseOutlined />}
                                    aria-label="删除"
                                    onClick={() => remove(account)}
                                  />
                                </Space>
                              </div>
                              <div className="mt-1 flex min-w-0 items-center gap-1.5">
                                <span
                                  className={`inline-block max-w-full truncate rounded-md px-1.5 py-0.5 text-xs font-semibold ${PACE_MESSAGE_CLASS[pace.status]}`}
                                >
                                  {pace.message}
                                </span>
                                <Tooltip title={PACE_LOGIC_HELP}>
                                  <QuestionCircleOutlined
                                    className="shrink-0 cursor-help text-[var(--text-muted)]"
                                    aria-label="鼓励文案说明"
                                  />
                                </Tooltip>
                              </div>
                            </div>
                            {!hasValidLink ? (
                              <div className="space-y-2">
                                <dl className="space-y-1.5 text-sm m-0">
                                  <div className="flex justify-between gap-3">
                                    <dt className="shrink-0 text-[var(--text-muted)]">开始日期</dt>
                                    <dd className="m-0 text-[var(--text)]">{account.startDate}</dd>
                                  </div>
                                  <div className="flex justify-between gap-3">
                                    <dt className="shrink-0 text-[var(--text-muted)]">预期达成</dt>
                                    <dd className="m-0 text-[var(--text)]">{account.targetDate}</dd>
                                  </div>
                                </dl>
                                <Empty
                                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                                  description="关联账目已失效，请重新关联"
                                />
                              </div>
                            ) : (
                              <FamilyMentalAccountLiquid
                                progress={progress}
                                targetAmount={account.targetAmount}
                                startDate={account.startDate}
                                targetDate={account.targetDate}
                                linkedAccountNames={linkedAccountNames}
                                showLinkedAccounts={account.showLinkedAccounts}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card
            className="family-finance-section-card family-mental-goals-card"
            title={<h2 className="family-finance-section__title">目标总览</h2>}
            loading={loading}
          >
            <div className="family-mental-goals-chart-wrap">
              <FamilyMentalGoalsBarChart aggregates={goalAggregates} />
            </div>
          </Card>
        </Col>
      </Row>

      <Modal
        title={editing ? '编辑心理账户' : '添加心理账户'}
        open={open}
        onCancel={() => {
          if (!savingRef.current) setOpen(false);
        }}
        onOk={() => save()}
        confirmLoading={saving}
        okButtonProps={{ disabled: saving || selectable.length === 0 }}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" className="mt-2">
          <Form.Item
            name="name"
            label="名称"
            rules={[
              { required: true, message: '请填写名称' },
              {
                validator: async (_, value: string) => {
                  const trimmed = (value ?? '').trim();
                  if (!trimmed) throw new Error('请填写名称');
                  if (trimmed.length > 32) throw new Error('名称不超过 32 字');
                },
              },
            ]}
          >
            <Input placeholder="如：应急金、旅游基金" maxLength={32} />
          </Form.Item>
          <Form.Item label="预期目标" required>
            <Space.Compact block>
              <Form.Item
                name="targetAmount"
                noStyle
                rules={[
                  { required: true, message: '请填写预期目标' },
                  {
                    type: 'number',
                    min: 0.01,
                    message: '预期目标必须大于 0',
                  },
                ]}
              >
                <InputNumber
                  min={0.01}
                  precision={2}
                  className="w-full"
                  placeholder="50000.00"
                />
              </Form.Item>
              <Input
                readOnly
                tabIndex={-1}
                value="元"
                aria-hidden
                className="w-12 text-center pointer-events-none"
              />
            </Space.Compact>
          </Form.Item>
          <Form.Item
            name="priority"
            label="优先级"
            rules={[{ required: true, message: '请选择优先级' }]}
          >
            <Select options={PRIORITY_OPTIONS} placeholder="选择 P0 / P1 / P2" />
          </Form.Item>
          <Form.Item
            name="startDate"
            label="开始日期"
            dependencies={['targetDate']}
            rules={[
              { required: true, message: '请选择开始日期' },
              {
                validator: async (_, value: Dayjs | null) => {
                  if (!value) return;
                  const targetDate = form.getFieldValue('targetDate') as Dayjs | undefined;
                  if (targetDate && value.isAfter(targetDate, 'day')) {
                    throw new Error('开始日期不能晚于预期达成日期');
                  }
                },
              },
            ]}
          >
            <DatePicker className="w-full" placeholder="选择开始日期" />
          </Form.Item>
          <Form.Item
            name="targetDate"
            label="预期达成日期"
            dependencies={['startDate']}
            rules={[
              { required: true, message: '请选择预期达成日期' },
              {
                validator: async (_, value: Dayjs | null) => {
                  if (!value) return;
                  if (!editing && value.isBefore(dayjs().startOf('day'))) {
                    throw new Error('预期达成日期不能早于今天');
                  }
                  const startDate = form.getFieldValue('startDate') as Dayjs | undefined;
                  if (startDate && startDate.isAfter(value, 'day')) {
                    throw new Error('开始日期不能晚于预期达成日期');
                  }
                },
              },
            ]}
          >
            <DatePicker
              className="w-full"
              placeholder="选择日期"
              disabledDate={
                editing
                  ? undefined
                  : current =>
                      Boolean(current && current.isBefore(dayjs().startOf('day')))
              }
            />
          </Form.Item>
          <Form.Item
            name="showLinkedAccounts"
            label="显示关联账户"
            valuePropName="checked"
            initialValue={true}
            layout="horizontal"
            colon={false}
            className="mb-4 [&_.ant-form-item-row]:flex [&_.ant-form-item-row]:items-center [&_.ant-form-item-row]:justify-between [&_.ant-form-item-label]:pb-0 [&_.ant-form-item-control]:w-auto [&_.ant-form-item-control]:grow-0"
          >
            <Switch />
          </Form.Item>
          <Form.Item
            name="ledgerItemIds"
            label="关联账目"
            rules={[{ type: 'array', min: 1, message: '请至少选择一笔账目' }]}
            extra={
              selectable.length === 0 ? (
                <span>
                  暂无可用账目，请先在
                  <Link href="/view/family/ledger"> 资产记账 </Link>
                  中添加并标注活钱 / 稳钱 / 长钱
                </span>
              ) : undefined
            }
          >
            <Select
              mode="multiple"
              placeholder="选择一到多笔账目（活钱 / 稳钱 / 长钱）"
              disabled={selectable.length === 0}
              options={selectable.map(s => ({ value: s.id, label: s.label }))}
              optionFilterProp="label"
            />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
