'use client';

import { formatTradeAmount } from '@/lib/grid/format-trade-amount';
import type { GridStrategyTradeSide } from '@/types/grid-strategy-trade';
import { Button, DatePicker, Form, InputNumber, Modal, type FormInstance } from 'antd';
import dayjs, { type Dayjs } from '@/lib/antd-dayjs';
import { useEffect, useState } from 'react';

export interface GridTradeEntryDefaults {
  side: GridStrategyTradeSide;
  levelKey: string;
  price: number;
  qty: number;
  maxSellQty?: number;
  priceDecimals: number;
}

export interface GridTradeEntryModalProps {
  open: boolean;
  loading?: boolean;
  defaults: GridTradeEntryDefaults | null;
  onCancel: () => void;
  /** 退场动画结束后回调：父层在此清空 defaults，保证 Modal 完整播完关闭动画 */
  afterClose: () => void;
  onSubmit: (values: {
    price: number;
    qty: number;
    tradeDate: string;
  }) => Promise<void>;
}

interface FormValues {
  price: number;
  qty: number;
  tradeDate: Dayjs;
}

const FULL_WIDTH = { width: '100%' } as const;

interface TradeEntryFieldsProps {
  form: FormInstance<FormValues>;
  defaults: GridTradeEntryDefaults;
  loading?: boolean;
  price: number | undefined;
  qty: number | undefined;
  onCancel: () => void;
  onSubmit: GridTradeEntryModalProps['onSubmit'];
}

/**
 * 记账表单字段与页脚。
 */
function TradeEntryFields({
  form,
  defaults,
  loading,
  price,
  qty,
  onCancel,
  onSubmit,
}: TradeEntryFieldsProps) {
  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={async values => {
        await onSubmit({
          price: values.price,
          qty: values.qty,
          tradeDate: values.tradeDate.format('YYYY-MM-DD'),
        });
      }}
    >
      <div className="grid-trade-entry-modal__pair">
        <Form.Item
          name="price"
          label="成交价"
          rules={[{ required: true, message: '请输入成交价' }]}
        >
          <InputNumber
            controls={false}
            min={0.0001}
            step={10 ** -defaults.priceDecimals}
            precision={defaults.priceDecimals}
            style={FULL_WIDTH}
          />
        </Form.Item>
        <Form.Item
          name="qty"
          label="股数"
          rules={[{ required: true, message: '请输入股数' }]}
        >
          <InputNumber
            controls={false}
            min={1}
            step={100}
            precision={0}
            max={defaults.side === 'sell' ? defaults.maxSellQty : undefined}
            style={FULL_WIDTH}
          />
        </Form.Item>
      </div>
      <Form.Item
        name="tradeDate"
        label="成交日"
        rules={[{ required: true, message: '请选择成交日' }]}
      >
        <DatePicker style={FULL_WIDTH} />
      </Form.Item>
      <div className="grid-trade-entry-modal__amount">
        <span>成交额</span>
        <span className="grid-trade-entry-modal__amount-value">
          {formatTradeAmount(price, qty)}
        </span>
      </div>
      <div className="grid-trade-entry-modal__footer">
        <Button disabled={loading} onClick={onCancel}>
          取消
        </Button>
        <Button type="primary" htmlType="submit" loading={loading}>
          {loading ? '正在记账…' : '确认'}
        </Button>
      </div>
    </Form>
  );
}

/**
 * 档位买卖记账弹窗。open 布尔与 defaults 数据解耦：
 * 关闭只翻转 open，defaults 保留至 afterClose 再清空，杜绝 return null 斩断退场动画。
 */
export function GridTradeEntryModal({
  open,
  loading,
  defaults,
  onCancel,
  afterClose,
  onSubmit,
}: GridTradeEntryModalProps) {
  const [form] = Form.useForm<FormValues>();
  const price = Form.useWatch('price', form);
  const qty = Form.useWatch('qty', form);
  // 渲染期优先取当前 defaults、退场期（父层已清空）回落到上一次的值：
  // 既零陈旧帧，又让 Modal 有内容可播完退场动画
  const [lastDefaults, setLastDefaults] = useState(defaults);

  useEffect(() => {
    if (defaults) setLastDefaults(defaults);
  }, [defaults]);

  const shownDefaults = defaults ?? lastDefaults;

  useEffect(() => {
    if (!open || !defaults) return;
    form.setFieldsValue({
      price: defaults.price,
      qty: defaults.qty,
      tradeDate: dayjs(),
    });
  }, [open, defaults, form]);

  return (
    <Modal
      open={open}
      title={defaults ? (defaults.side === 'buy' ? '记录买入' : '记录卖出') : '记账'}
      onCancel={onCancel}
      afterClose={afterClose}
      footer={null}
      destroyOnHidden
      width={400}
      centered
      closable={!loading}
      maskClosable={!loading}
      keyboard={!loading}
      wrapClassName="grid-trade-entry-modal"
    >
      {defaults ? (
        <TradeEntryFields
          form={form}
          defaults={defaults}
          loading={loading}
          price={price}
          qty={qty}
          onCancel={onCancel}
          onSubmit={onSubmit}
        />
      ) : null}
    </Modal>
  );
}
