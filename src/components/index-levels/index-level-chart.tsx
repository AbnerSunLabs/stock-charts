'use client';

import { useMemo, useState } from 'react';
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import {
  closeAxisMax,
  filterCloseSpan,
  formatCloseTick,
  type CloseSpan,
  type IndexClosePoint,
} from '@/lib/index-levels/close-series';
import { formatClose } from '@/lib/index-levels/position';

const SPANS: Array<{ id: CloseSpan; label: string }> = [
  { id: 'all', label: '上市以来' },
  { id: '10', label: '近 10 年' },
  { id: '5', label: '近 5 年' },
];

/**
 * 官方收盘折线。库里没有市盈率序列，所以只画收盘。
 */
export function IndexLevelChart({
  name,
  points,
  phase,
}: {
  name: string;
  points: IndexClosePoint[];
  phase: 'loading' | 'ready' | 'error';
}) {
  const [span, setSpan] = useState<CloseSpan>('all');
  const rows = useMemo(() => filterCloseSpan(points, span), [points, span]);
  const max = closeAxisMax(rows.reduce((peak, row) => Math.max(peak, row.close), 0));
  const last = rows[rows.length - 1];

  return (
    <section className="card chart-card" aria-label="收盘折线">
      <div className="chart-head">
        <h2>{name}</h2>
        <div className="ranges" role="tablist">
          {SPANS.map(item => (
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
      <ChartBody phase={phase} rows={rows} max={max} />
      <p className="asof">{last ? `更新至 ${last.tradeDate.replaceAll('-', '/')}` : ''}</p>
    </section>
  );
}

function ChartBody({
  phase,
  rows,
  max,
}: {
  phase: 'loading' | 'ready' | 'error';
  rows: IndexClosePoint[];
  max: number;
}) {
  if (phase === 'loading') return <p className="chart-note">读取收盘…</p>;
  if (phase === 'error') return <p className="chart-note">收盘暂时读不出来</p>;
  if (rows.length === 0) return <p className="chart-note">暂无收盘</p>;
  return (
    <div className="chart-plot">
      <ResponsiveContainer width="100%" height={380}>
        <ComposedChart data={rows} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="rgba(15,23,42,0.06)" vertical={false} />
          <XAxis
            dataKey="tradeDate"
            minTickGap={56}
            tickFormatter={value => String(value).slice(0, 4)}
            tick={{ fill: 'rgba(15,23,42,0.52)', fontSize: 11 }}
            axisLine={{ stroke: 'rgba(15,23,42,0.15)' }}
            tickLine={false}
          />
          <YAxis
            domain={[0, max]}
            width={44}
            tickFormatter={value => formatCloseTick(Number(value), max)}
            tick={{ fill: 'rgba(15,23,42,0.45)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            formatter={value => [formatClose(Number(value)), '收盘']}
            labelFormatter={label => String(label)}
          />
          <Area dataKey="close" stroke="none" fill="rgba(37,99,235,0.08)" isAnimationActive={false} />
          <Line dataKey="close" stroke="#2563eb" strokeWidth={1.6} dot={false} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
