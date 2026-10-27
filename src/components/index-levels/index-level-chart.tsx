'use client';

import { useMemo, useState } from 'react';
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import {
  changePercent,
  closePlotDomain,
  filterCloseSpan,
  formatCloseTick,
  withRunningHigh,
  type CloseSpan,
  type IndexClosePoint,
} from '@/lib/index-levels/close-series';

const SPANS: Array<{ id: CloseSpan; label: string; word: string }> = [
  { id: 'all', label: '上市以来', word: '历史' },
  { id: '10', label: '近 10 年', word: '10年' },
  { id: '5', label: '近 5 年', word: '5年' },
];

const PRICE = '#B5C4B1';

/**
 * 收盘折线按 etf.run 的收盘序列画：右轴、鼠尾草绿、渐变。
 * 等权市盈率和五年/十年均线不在本库，不另造一条线。
 */
export function IndexLevelChart({
  name,
  code,
  points,
  phase,
}: {
  name: string;
  code: string;
  points: IndexClosePoint[];
  phase: 'loading' | 'ready' | 'error';
}) {
  const [span, setSpan] = useState<CloseSpan>('all');
  const rows = useMemo(() => filterCloseSpan(withRunningHigh(points), span), [points, span]);
  const [axisMin, axisMax] = closePlotDomain(rows);
  const spans = SPANS.map(item =>
    item.id === 'all' && code.endsWith('.OTH') ? { ...item, label: '全部', word: '区间' } : item
  );
  const last = rows[rows.length - 1];
  const spanWord = spans.find(item => item.id === span)?.word ?? '历史';

  return (
    <section className="card chart-card" aria-label="收盘折线">
      <div className="chart-head">
        <h2>{name}</h2>
        <div className="ranges" role="tablist">
          {spans.map(item => (
            <button
              key={item.id}
              type="button"
              aria-pressed={span === item.id}
              onClick={() => setSpan(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <span />
      </div>
      <ChartBody phase={phase} rows={rows} min={axisMin} max={axisMax} name={name} code={code} spanWord={spanWord} />
      <p className="asof">{last ? `更新至 ${last.tradeDate.replaceAll('-', '/')}` : ''}</p>
    </section>
  );
}

function ChartBody({
  phase,
  rows,
  min,
  max,
  name,
  code,
  spanWord,
}: {
  phase: 'loading' | 'ready' | 'error';
  rows: Array<IndexClosePoint & { maxClose: number }>;
  min: number;
  max: number;
  name: string;
  code: string;
  spanWord: string;
}) {
  if (phase === 'loading') return <p className="chart-note">读取收盘…</p>;
  if (phase === 'error') return <p className="chart-note">收盘暂时读不出来</p>;
  if (rows.length === 0) return <p className="chart-note">暂无收盘</p>;
  const base = rows[0]?.close ?? 0;
  return (
    <div className="chart-plot">
      <ResponsiveContainer width="100%" height={380}>
        <ComposedChart data={rows} margin={{ top: 8, right: 8, left: 8, bottom: 4 }}>
          <defs>
            <linearGradient id="close-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#B5C4B1" stopOpacity="0.2" />
              <stop offset="1" stopColor="#B5C4B1" stopOpacity="0" />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#F0F0F0" vertical={false} />
          <XAxis
            dataKey="tradeDate"
            minTickGap={56}
            tickFormatter={value => String(value).slice(0, 4)}
            tick={{ fill: '#4b5563', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            orientation="right"
            domain={[min, max]}
            width={max < 20 ? 52 : 44}
            tickFormatter={value => formatCloseTick(Number(value), max)}
            tick={{ fill: '#4b5563', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ stroke: PRICE, strokeWidth: 1 }}
            content={props => (
              <CloseTip {...props} name={name} code={code} spanWord={spanWord} base={base} />
            )}
          />
          <Area dataKey="close" stroke="none" fill="url(#close-fill)" isAnimationActive={false} />
          <Line dataKey="close" stroke={PRICE} strokeWidth={1} dot={false} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function CloseTip({
  active,
  payload,
  label,
  name,
  code,
  spanWord,
  base,
}: {
  active?: boolean;
  payload?: Array<{ value?: number; payload?: { maxClose?: number } }>;
  label?: string | number;
  name: string;
  code: string;
  spanWord: string;
  base: number;
}) {
  if (!active || !payload?.length) return null;
  const close = Number(payload[0]?.value);
  if (!Number.isFinite(close)) return null;
  const maxClose = payload[0]?.payload?.maxClose ?? close;
  const since = changePercent(base, close);
  const fromHigh = changePercent(maxClose, close);
  const bareCode = code.replace(/\.(SH|SZ|CSI|OTH)$/, '');
  return (
    <div className="etf-tip">
      <div className="etf-tip__head">
        <i />
        <div>
          <b>
            {name} <span>({bareCode})</span>
          </b>
          <em>{String(label ?? '')}</em>
        </div>
      </div>
      <div className="etf-tip__row">
        <i className="price" />
        <div>
          <div>收盘价: {close}</div>
          <div>
            {spanWord}累计涨跌: <Pct value={since} />
          </div>
          <div>
            距前高下跌: <Pct value={fromHigh} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Pct({ value }: { value: number | null }) {
  if (value == null) return <span>N/A</span>;
  const up = value >= 0;
  return <span className={up ? 'up' : 'down'}>{`${value.toFixed(2)}%`}</span>;
}
