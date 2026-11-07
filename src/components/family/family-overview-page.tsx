'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { EyeFilled, EyeInvisibleFilled } from '@ant-design/icons';
import {
  App,
  Button,
  Card,
  Col,
  Drawer,
  Empty,
  Form,
  Input,
  Row,
  Select,
  Space,
  Table,
} from 'antd';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { FamilyFinanceRepository } from '@/lib/supabase/family-finance-repository';
import {
  MEMBER_ROLE_LABELS,
  type FamilyBalanceSnapshot,
  type FamilyLedgerItem,
  type FamilyMember,
  type FamilyMemberRole,
  type FamilyMentalAccount,
} from '@/types/family-finance';
import { computeLedgerTotals } from '@/lib/family-finance/aggregates';
import { FamilyAmountVisibilityProvider } from '@/components/family/family-amount-visibility';
import { FamilyAssetSankey } from '@/components/family/family-asset-sankey';
import { FamilyBalanceTrendChart } from '@/components/family/family-balance-trend-chart';
import { FamilyMentalAccountsPanel } from '@/components/family/family-mental-accounts-panel';
import { FamilyFinanceMetricCard } from '@/components/family/family-finance-metric-card';
import { FamilyPoliciesPage } from '@/components/family/family-policies-page';

/**
 * 家庭财务总览（直接读活账合计）。
 */
export function FamilyOverviewPage() {
  const { message, modal } = App.useApp();
  const repo = useMemo(() => new FamilyFinanceRepository(createBrowserSupabaseClient()), []);

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<FamilyLedgerItem[]>([]);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [mentalAccounts, setMentalAccounts] = useState<FamilyMentalAccount[]>([]);
  const [balanceSnapshots, setBalanceSnapshots] = useState<FamilyBalanceSnapshot[]>(
    []
  );
  const [memberDrawer, setMemberDrawer] = useState(false);
  /** 金额默认隐藏；每次进入页面重置，不持久化。 */
  const [amountsVisible, setAmountsVisible] = useState(false);
  const [memberForm] = Form.useForm();

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      await repo.ensureSelfMember();
      const [ledgerItems, m, mental, snapshots] = await Promise.all([
        repo.listLedgerItems(),
        repo.listMembers(),
        repo.listMentalAccounts(),
        repo.listBalanceSnapshots(),
      ]);
      setItems(ledgerItems);
      setMembers(m);
      setMentalAccounts(mental);
      setBalanceSnapshots(snapshots);
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
  const hasLedger = items.length > 0;

  const headerActions = (
    <Space wrap className="family-finance-header__actions" align="center">
      <Button
        className="family-finance-secondary-action family-finance-action--secondary"
        onClick={() => setMemberDrawer(true)}
      >
        成员管理
      </Button>
      <Link href="/view/family/ledger">
        <Button
          type="primary"
          className="family-finance-primary-action family-finance-action--primary"
        >
          {hasLedger ? '更新资产' : '前往资产记账'}
        </Button>
      </Link>
    </Space>
  );

  const pageHeader = (
    <header className="family-finance-header">
      <div>
        <div className="family-finance-eyebrow">家庭资产</div>
        <div className="family-finance-header__title-row">
          <h1>家庭财务总览</h1>
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
        <p>把家庭当作一家小公司，在同一张财务视图里看清资产、负债与保障。</p>
      </div>
      {headerActions}
    </header>
  );

  const memberDrawerNode = (
    <Drawer
      title="家庭成员"
      open={memberDrawer}
      onClose={() => setMemberDrawer(false)}
      width={360}
    >
      <Table
        size="small"
        rowKey="id"
        pagination={false}
        dataSource={members}
        columns={[
          { title: '姓名', dataIndex: 'name' },
          {
            title: '角色',
            dataIndex: 'role',
            render: (r: FamilyMemberRole) => MEMBER_ROLE_LABELS[r],
          },
          {
            title: '操作',
            render: (_, row) => (
              <Space size="small">
                <Button
                  type="link"
                  size="small"
                  onClick={() => {
                    modal.confirm({
                      title: '改名',
                      content: (
                        <Input
                          defaultValue={row.name}
                          id="rename-member-input"
                          onPressEnter={e => {
                            const v = (e.target as HTMLInputElement).value;
                            void (async () => {
                              await repo.renameMember(row.id, v);
                              message.success('已改名');
                              await reload();
                            })();
                          }}
                        />
                      ),
                      onOk: async () => {
                        const el = document.getElementById(
                          'rename-member-input'
                        ) as HTMLInputElement | null;
                        if (!el?.value.trim()) throw new Error('名称不能为空');
                        await repo.renameMember(row.id, el.value);
                        message.success('已改名');
                        await reload();
                      },
                    });
                  }}
                >
                  改名
                </Button>
                {row.role !== 'self' && (
                  <Button
                    type="link"
                    size="small"
                    danger
                    onClick={() => {
                      modal.confirm({
                        title: `删除成员「${row.name}」？`,
                        onOk: async () => {
                          try {
                            await repo.deleteMember(row.id);
                            message.success('已删除');
                            await reload();
                          } catch (e) {
                            message.error(e instanceof Error ? e.message : '删除失败');
                            throw e;
                          }
                        },
                      });
                    }}
                  >
                    删除
                  </Button>
                )}
              </Space>
            ),
          },
        ]}
      />
      <Form
        form={memberForm}
        layout="vertical"
        className="mt-4"
        onFinish={async values => {
          try {
            await repo.createMember({
              name: values.name,
              role: values.role,
            });
            memberForm.resetFields();
            message.success('已添加成员');
            await reload();
          } catch (e) {
            message.error(e instanceof Error ? e.message : '添加失败');
          }
        }}
      >
        <Form.Item name="name" label="新成员姓名" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Form.Item name="role" label="角色" initialValue="spouse" rules={[{ required: true }]}>
          <Select
            options={[
              { value: 'spouse', label: '配偶' },
              { value: 'child', label: '子女' },
              { value: 'other', label: '其他' },
            ]}
          />
        </Form.Item>
        <Button type="dashed" htmlType="submit" block>
          + 添加成员
        </Button>
      </Form>
    </Drawer>
  );

  if (!loading && !hasLedger) {
    return (
      <FamilyAmountVisibilityProvider value={amountsVisible}>
        <div className="family-finance-page family-overview-page space-y-6">
          {pageHeader}
          <Card className="family-finance-section-card family-finance-empty-card">
            <Empty description="尚无资产条目。请前往资产记账添加后，总览会即时展示。" />
          </Card>
          <Card className="family-finance-section-card family-overview-policies-card">
            <FamilyPoliciesPage embedded />
          </Card>
          {memberDrawerNode}
        </div>
      </FamilyAmountVisibilityProvider>
    );
  }

  return (
    <FamilyAmountVisibilityProvider value={amountsVisible}>
      <div className="family-finance-page family-overview-page space-y-6">
        {pageHeader}

        <Row gutter={[16, 16]} className="family-overview-kpi-trend-row">
          <Col xs={24} lg={8} xxl={6}>
            <div className="family-overview-kpi-stack">
              <FamilyFinanceMetricCard
                label="总资产"
                value={totals.totalAssets}
                tone="primary"
                loading={loading}
                hint="家庭当前资产合计"
              />
              <FamilyFinanceMetricCard
                label="总负债"
                value={totals.totalLiabilities}
                tone="neutral"
                loading={loading}
                hint="家庭共同负债合计"
              />
              <FamilyFinanceMetricCard
                label="净资产"
                value={totals.netWorth}
                tone={totals.netWorth < 0 ? 'negative' : 'positive'}
                loading={loading}
                hint="总资产扣除总负债"
              />
            </div>
          </Col>
          <Col xs={24} lg={16} xxl={18}>
            <FamilyBalanceTrendChart points={balanceSnapshots} loading={loading} />
          </Col>
        </Row>

        <div className="family-overview-structure-and-panels flex flex-col gap-8">
          <Card
            className="family-finance-section-card family-overview-structure-card"
            loading={loading}
            title={
              <div>
                <h2 className="family-finance-section__title">资产结构</h2>
                <p className="family-finance-section__description">
                  从家庭总资产到成员与四笔钱，查看资金分布与负债关系。
                </p>
              </div>
            }
          >
            <FamilyAssetSankey items={items} members={members} />
          </Card>

          <Row gutter={[16, 16]} className="family-overview-panels-row">
            <Col xs={24}>
              <div className="family-overview-mental-panel">
                <FamilyMentalAccountsPanel
                  repo={repo}
                  loading={loading}
                  items={items}
                  members={members}
                  accounts={mentalAccounts}
                  onChanged={reload}
                />
              </div>
            </Col>
            <Col xs={24}>
              <Card
                className="family-finance-section-card family-overview-policies-card"
                loading={loading}
              >
                <FamilyPoliciesPage embedded />
              </Card>
            </Col>
          </Row>
        </div>

        {memberDrawerNode}
      </div>
    </FamilyAmountVisibilityProvider>
  );
}
