'use client';

import { formatTradeAmount } from '@/lib/grid/format-trade-amount';
import type { GridStrategyTradeSide } from '@/types/grid-strategy-trade';
import { Button, DatePicker, Form, InputNumber, Modal } from 'antd';
import type { FormInstance } from 'antd/es/form';
import dayjs, { type Dayjs } from 'dayjs';
import { useEffect } from 'react';

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
        <Button onClick={onCancel}>取消</Button>
        <Button type="primary" htmlType="submit" loading={loading}>
          确认
        </Button>
      </div>
    </Form>
  );
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
  const price = Form.useWatch('price', form);
  const qty = Form.useWatch('qty', form);

  useEffect(() => {
    if (!open || !defaults) return;
    form.setFieldsValue({
      price: defaults.price,
      qty: defaults.qty,
      tradeDate: dayjs(),
    });
  }, [open, defaults, form]);

  if (!defaults) return null;

  return (
    <Modal
      open={open}
      title={defaults.side === 'buy' ? '记录买入' : '记录卖出'}
      onCancel={onCancel}
      footer={null}
      destroyOnClose
      width={400}
      centered
      wrapClassName="grid-trade-entry-modal"
    >
      <TradeEntryFields
        form={form}
        defaults={defaults}
        loading={loading}
        price={price}
        qty={qty}
        onCancel={onCancel}
        onSubmit={onSubmit}
      />
    </Modal>
  );
}
