'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  App,
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Table,
  Tag,
} from 'antd';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { FamilyFinanceRepository } from '@/lib/supabase/family-finance-repository';
import {
  POLICY_TYPE_LABELS,
  COVERAGE_POLICY_TYPES,
  type FamilyMember,
  type InsurancePolicy,
  type PolicyStatus,
  type PolicyType,
} from '@/types/family-finance';
import { computePolicyCoverage } from '@/lib/family-finance/aggregates';
import { FamilyAmountText } from '@/components/family/family-amount-text';
import {
  FamilyMotionStyles,
  useFamilyRowFadeRemoval,
} from '@/components/family/family-motion';

/** 保单状态枚举 → 中文文案与 Tag 色（禁止把 lapsed/pending 直接暴露给用户）。 */
const POLICY_STATUS_META: Record<PolicyStatus, { label: string; color: string }> = {
  active: { label: '有效', color: 'green' },
  lapsed: { label: '已失效', color: 'default' },
  pending: { label: '待生效', color: 'gold' },
};

/** 状态翻转（如无→有保障）时 Tag 颜色/边框的统一过渡：small 档、只动颜色类属性。 */
const TAG_TRANSITION_CLASS =
  'transition-[color,border-color,background-color] duration-[var(--motion-duration-small)] ease-[var(--motion-ease-out)]';

/**
 * 保单管理页面；可作为家庭财务总览内嵌面板复用。
 */
export function FamilyPoliciesPage({ embedded = false }: { embedded?: boolean }) {
  const { message, modal } = App.useApp();
  const repo = useMemo(() => new FamilyFinanceRepository(createBrowserSupabaseClient()), []);

  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [policies, setPolicies] = useState<InsurancePolicy[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<InsurancePolicy | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  /** 首屏加载完成后，后续增删改一律静默刷新（不再整表骨架闪一遍） */
  const loadedOnceRef = useRef(false);
  const { removingIds, fadeOutRow, settleRemovals } = useFamilyRowFadeRemoval();
  const [form] = Form.useForm();

  const reload = useCallback(async () => {
    // 状态变化：首屏加载 → 表格骨架；保单增删改 → 静默刷新（弹窗按钮自有 confirmLoading）
    const silent = loadedOnceRef.current;
    if (!silent) setLoading(true);
    try {
      await repo.ensureSelfMember();
      const [m, p] = await Promise.all([repo.listMembers(), repo.listPolicies()]);
      setMembers(m);
      setPolicies(p);
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

  const coverage = useMemo(() => computePolicyCoverage(policies), [policies]);
  const memberName = useMemo(() => new Map(members.map(m => [m.id, m.name])), [members]);
  const policyTypeOptions = useMemo(() => {
    const base = COVERAGE_POLICY_TYPES.map(t => ({
      value: t,
      label: POLICY_TYPE_LABELS[t],
    }));
    // 编辑历史财产/其他保单时临时并入选项，避免 Select 空白
    if (
      editing &&
      !COVERAGE_POLICY_TYPES.includes(editing.policyType)
    ) {
      return [
        ...base,
        {
          value: editing.policyType,
          label: POLICY_TYPE_LABELS[editing.policyType],
        },
      ];
    }
    return base;
  }, [editing]);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({
      policyType: 'life',
      status: 'active',
      coverageAmount: 0,
      annualPremium: 0,
      memberId: members.find(m => m.role === 'self')?.id,
    });
    setOpen(true);
  };

  const save = async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      const values = await form.validateFields();
      await repo.upsertPolicy({
        id: editing?.id,
        memberId: values.memberId,
        policyType: values.policyType,
        name: values.name,
        insurer: values.insurer,
        coverageAmount: values.coverageAmount,
        annualPremium: values.annualPremium,
        status: values.status,
        note: values.note,
        startDate: editing?.startDate,
        endDate: editing?.endDate,
      });
      message.success(editing ? '已更新保单' : '已添加保单');
      setOpen(false);
      await reload();
    } catch (e) {
      if (e && typeof e === 'object' && 'errorFields' in e) return;
      message.error(e instanceof Error ? e.message : '保存失败');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    /* 状态变化：独立页面首次进入 —— 根容器统一 motion-enter；内嵌总览时不重复入场 */
    <div className={`space-y-4 ${embedded ? '' : 'motion-enter'}`}>
      <FamilyMotionStyles />
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          {embedded ? (
            <h2 className="font-[var(--font-display)] text-base font-semibold m-0 mb-2">
              家庭保单
            </h2>
          ) : (
            <h1 className="font-[var(--font-display)] text-xl font-semibold m-0 mb-2">
              保单管理
            </h1>
          )}
          <Space wrap size="small">
            <span className="text-sm text-[var(--text-muted)]">覆盖摘要：</span>
            {/* 状态变化：保单增删后 ✓/○ 与配色翻转 —— Tag 颜色过渡（small 档），状态翻转有交代 */}
            {coverage.map(c => (
              <Tag
                key={c.policyType}
                color={c.covered ? 'success' : 'default'}
                className={TAG_TRANSITION_CLASS}
              >
                {POLICY_TYPE_LABELS[c.policyType]}
                {c.covered ? '✓' : '○'}
              </Tag>
            ))}
          </Space>
        </div>
        <Button type="primary" onClick={openCreate}>
          + 添加保单
        </Button>
      </div>

      <Table
        loading={loading}
        rowKey="id"
        dataSource={policies}
        pagination={{ pageSize: 10 }}
        scroll={{ x: 'max-content' }}
        /* 状态变化：删除确认成功 → 该行先淡出（exit-small）再静默刷新数据 */
        rowClassName={record => (removingIds.has(record.id) ? 'family-row-removing' : '')}
        columns={[
          {
            title: '名称',
            dataIndex: 'name',
            fixed: 'left',
            width: 140,
            ellipsis: true,
          },
          {
            title: '类型',
            dataIndex: 'policyType',
            width: 64,
            onHeaderCell: () => ({ style: { whiteSpace: 'nowrap' } }),
            onCell: () => ({ style: { whiteSpace: 'nowrap' } }),
            render: (t: PolicyType) => POLICY_TYPE_LABELS[t],
          },
          {
            title: '被保人',
            dataIndex: 'memberId',
            width: 88,
            onHeaderCell: () => ({ style: { whiteSpace: 'nowrap' } }),
            onCell: () => ({ style: { whiteSpace: 'nowrap' } }),
            render: (id: string) => memberName.get(id) ?? '—',
          },
          {
            title: '保额',
            dataIndex: 'coverageAmount',
            align: 'right',
            width: 120,
            /* 状态变化：金额显隐切换——同宽掩码 + blur/opacity 淡切，列宽不抖 */
            render: (v: number) => (
              <FamilyAmountText amount={v} className="family-finance-monetary-value" />
            ),
          },
          {
            title: '年缴',
            dataIndex: 'annualPremium',
            align: 'right',
            width: 120,
            render: (v: number) => (
              <FamilyAmountText amount={v} className="family-finance-monetary-value" />
            ),
          },
          {
            title: '状态',
            dataIndex: 'status',
            width: 80,
            /* 状态变化：有效/已失效/待生效翻转 —— 中文枚举 + Tag 颜色过渡 */
            render: (s: PolicyStatus) => (
              <Tag color={POLICY_STATUS_META[s].color} className={TAG_TRANSITION_CLASS}>
                {POLICY_STATUS_META[s].label}
              </Tag>
            ),
          },
          {
            title: '操作',
            width: 120,
            onHeaderCell: () => ({ style: { whiteSpace: 'nowrap' } }),
            onCell: () => ({ style: { whiteSpace: 'nowrap' } }),
            render: (_, row) => (
              <Space size={0}>
                <Button
                  type="link"
                  size="small"
                  onClick={() => {
                    setEditing(row);
                    form.setFieldsValue({
                      memberId: row.memberId,
                      policyType: row.policyType,
                      name: row.name,
                      insurer: row.insurer,
                      coverageAmount: row.coverageAmount,
                      annualPremium: row.annualPremium,
                      status: row.status,
                      note: row.note,
                    });
                    setOpen(true);
                  }}
                >
                  编辑
                </Button>
                <Button
                  type="link"
                  size="small"
                  danger
                  onClick={() => {
                    modal.confirm({
                      title: '删除保单？',
                      onOk: async () => {
                        // 状态变化：删除确认成功 → 该行先淡出（exit-small）再静默刷新数据
                        await repo.deletePolicy(row.id);
                        message.success('已删除保单');
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
          },
        ]}
      />

      <Modal
        title={editing ? '编辑保单' : '添加保单'}
        open={open}
        onCancel={() => {
          if (!savingRef.current) setOpen(false);
        }}
        onOk={() => save()}
        confirmLoading={saving}
        okButtonProps={{ disabled: saving }}
        okText={saving ? '保存中…' : '保存'}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" className="mt-2">
          <Form.Item name="name" label="名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="policyType" label="类型" rules={[{ required: true }]}>
            <Select options={policyTypeOptions} />
          </Form.Item>
          <Form.Item name="memberId" label="被保人" rules={[{ required: true }]}>
            <Select options={members.map(m => ({ value: m.id, label: m.name }))} />
          </Form.Item>
          <Form.Item name="insurer" label="保险公司">
            <Input />
          </Form.Item>
          <Form.Item name="coverageAmount" label="保额" rules={[{ required: true }]}>
            <InputNumber min={0} precision={2} className="w-full" />
          </Form.Item>
          <Form.Item name="annualPremium" label="年缴" rules={[{ required: true }]}>
            <InputNumber min={0} precision={2} className="w-full" />
          </Form.Item>
          <Form.Item name="status" label="状态" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'active', label: '有效' },
                { value: 'lapsed', label: '已失效' },
                { value: 'pending', label: '待生效' },
              ]}
            />
          </Form.Item>
          <Form.Item name="note" label="备注">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
