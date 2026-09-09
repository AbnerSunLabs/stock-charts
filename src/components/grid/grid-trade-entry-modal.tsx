'use client';

import type { GridStrategyTradeSide } from '@/types/grid-strategy-trade';
import { Button, DatePicker, Form, InputNumber, Modal, Space } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useEffect } from 'react';

export interface GridTradeEntryDefaults {
  side: GridStrategyTradeSide;
  levelKey: string;
  price: number;
  qty: number;
  maxSellQty?: number;
  priceDecimals: number;
  hint?: string;
}

export interface GridTradeEntryModalProps {
  open: boolean;
  loading?: boolean;
  defaults: GridTradeEntryDefaults | null;
  onCancel: () => void;
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

/**
 * 档位买卖记账弹窗。
 */
export function GridTradeEntryModal({
  open,
  loading,
  defaults,
  onCancel,
  onSubmit,
}: GridTradeEntryModalProps) {
  const [form] = Form.useForm<FormValues>();

  useEffect(() => {
    if (!open || !defaults) return;
    form.setFieldsValue({
      price: defaults.price,
      qty: defaults.qty,
      tradeDate: dayjs(),
    });
  }, [open, defaults, form]);

  if (!defaults) return null;

  const title = defaults.side === 'buy' ? '记录买入' : '记录卖出';

  return (
    <Modal
      open={open}
      title={title}
      onCancel={onCancel}
      footer={null}
      destroyOnClose
    >
      {defaults.hint ? (
        <p className="mb-3 text-xs text-[var(--muted-foreground)]">
          {defaults.hint}
        </p>
      ) : null}
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
        <Form.Item
          name="price"
          label="成交价"
          rules={[{ required: true, message: '请输入成交价' }]}
        >
          <InputNumber
            className="w-full"
            min={0.0001}
            step={10 ** -defaults.priceDecimals}
            precision={defaults.priceDecimals}
          />
        </Form.Item>
        <Form.Item
          name="qty"
          label="股数"
          rules={[{ required: true, message: '请输入股数' }]}
        >
          <InputNumber
            className="w-full"
            min={1}
            step={100}
            precision={0}
            max={
              defaults.side === 'sell' ? defaults.maxSellQty : undefined
            }
          />
        </Form.Item>
        <Form.Item
          name="tradeDate"
          label="成交日"
          rules={[{ required: true, message: '请选择成交日' }]}
        >
          <DatePicker className="w-full" />
        </Form.Item>
        <Space className="w-full justify-end">
          <Button onClick={onCancel}>取消</Button>
          <Button type="primary" htmlType="submit" loading={loading}>
            确认
          </Button>
        </Space>
      </Form>
    </Modal>
  );
}
