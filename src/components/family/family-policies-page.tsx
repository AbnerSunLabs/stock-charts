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
import { formatCny } from '@/lib/family-finance/format';
import { useFamilyAmountVisibility } from '@/components/family/family-amount-visibility';

/**
 * 保单管理页面；可作为家庭财务总览内嵌面板复用。
 */
export function FamilyPoliciesPage({ embedded = false }: { embedded?: boolean }) {
  const { message, modal } = App.useApp();
  const repo = useMemo(() => new FamilyFinanceRepository(createBrowserSupabaseClient()), []);
  const amountsVisible = useFamilyAmountVisibility();

  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [policies, setPolicies] = useState<InsurancePolicy[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<InsurancePolicy | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [form] = Form.useForm();

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      await repo.ensureSelfMember();
      const [m, p] = await Promise.all([repo.listMembers(), repo.listPolicies()]);
      setMembers(m);
      setPolicies(p);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [repo, message]);

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
      message.success(editing ? '已更新' : '已添加');
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
    <div className="space-y-4">
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
            {coverage.map(c => (
              <Tag key={c.policyType} color={c.covered ? 'success' : 'default'}>
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
            render: (v: number) => formatCny(v, { visible: amountsVisible }),
          },
          {
            title: '年缴',
            dataIndex: 'annualPremium',
            align: 'right',
            width: 120,
            render: (v: number) => formatCny(v, { visible: amountsVisible }),
          },
          {
            title: '状态',
            dataIndex: 'status',
            width: 80,
            render: (s: PolicyStatus) =>
              s === 'active' ? <Tag color="green">有效</Tag> : <Tag>{s}</Tag>,
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
                        await repo.deletePolicy(row.id);
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
                { value: 'lapsed', label: '失效' },
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
