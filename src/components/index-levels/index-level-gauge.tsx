'use client';

import { useLayoutEffect, useRef } from 'react';

import type { IndexLevelMark } from '@/lib/index-levels/catalog';
import { GAUGE, arcPath, gaugeBounds, gaugeDeg, majorStep, polar, textAnchor } from '@/lib/index-levels/gauge';
import { changePct, formatClose, formatMarkLabel, gapPercentPhrase } from '@/lib/index-levels/position';
import type { IndexLatestClose } from '@/lib/supabase/index-daily-repository';

type Phase = 'loading' | 'ready' | 'error';

/**
 * 收盘在判断点位之间的位置。灰色刻度留着，指针用蓝色。
 */
export function IndexLevelGauge({
  levels,
  close,
  phase,
}: {
  levels: IndexLevelMark[];
  close: IndexLatestClose | null;
  phase: Phase;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const ready = phase === 'ready' && close != null;
  const points = levels.map(level => level.point);
  if (ready && close) points.push(close.close);
  const { top, bottom } = gaugeBounds(points.length ? points : [0, 1]);
  const at = (value: number) => gaugeDeg(value, bottom, top);

  useLayoutEffect(() => {
    const svg = ref.current;
    if (!svg) return;
    separateLabels(svg);
  }, [close, levels, phase]);

  return (
    <section className="card gauge-card" aria-label="点位仪表盘">
      <svg ref={ref} className="gauge" viewBox="-28 -52 556 500" role="img">
        <GaugeDefs />
        <circle className="face" cx={GAUGE.cx} cy={GAUGE.cy} r={GAUGE.face} />
        <path className="track" d={arcPath(GAUGE.r, GAUGE.start, GAUGE.start + GAUGE.sweep)} />
        <GaugeTicks levels={levels} close={ready ? close : null} bottom={bottom} top={top} />
        {levels.map(level => (
          <NamedMark key={level.name} level={level} angle={at(level.point)} />
        ))}
        {ready && close ? <Needle angle={at(close.close)} /> : null}
        <GaugeCaption levels={levels} close={ready ? close : null} phase={phase} />
      </svg>
    </section>
  );
}

function GaugeDefs() {
  return (
    <defs>
      <linearGradient id="face-fill" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#ffffff" />
        <stop offset="1" stopColor="#e4edf6" />
      </linearGradient>
    </defs>
  );
}

function GaugeTicks({
  levels,
  close,
  bottom,
  top,
}: {
  levels: IndexLevelMark[];
  close: IndexLatestClose | null;
  bottom: number;
  top: number;
}) {
  const step = majorStep(top - bottom);
  const lines = [];
  for (let value = Math.ceil(bottom / (step / 5)) * (step / 5); value <= top; value += step / 5) {
    if (levels.some(level => Math.abs(level.point - value) < step * 0.08)) continue;
    const major = Math.abs(value / step - Math.round(value / step)) < 1e-6;
    const angle = gaugeDeg(value, bottom, top);
    const a = polar(major ? GAUGE.r - 8 : GAUGE.r - 2, angle);
    const b = polar(major ? GAUGE.r + 14 : GAUGE.r + 7, angle);
    lines.push(
      <line key={`t-${value}`} className={major ? 'tick major' : 'tick'} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} />
    );
    const nearLevel = levels.some(level => Math.abs(level.point - value) < step * 0.45);
    const nearClose = close != null && Math.abs(value - close.close) < step * 0.35;
    if (!major || nearLevel || nearClose) continue;
    const spot = polar(GAUGE.face + 14, angle);
    lines.push(
      <text key={`n-${value}`} className="num" x={spot[0]} y={spot[1]} textAnchor={textAnchor(angle)} dominantBaseline="middle">
        {step < 1 ? value.toFixed(2) : Math.round(value).toLocaleString('zh-CN')}
      </text>
    );
  }
  return <g>{lines}</g>;
}

function NamedMark({ level, angle }: { level: IndexLevelMark; angle: number }) {
  const a = polar(GAUGE.r - 8, angle);
  const b = polar(GAUGE.r + 18, angle);
  const spot = polar(GAUGE.face + 22, angle);
  return (
    <g>
      <line className="tick named" x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} />
      <text className="rim" x={spot[0]} y={spot[1]} textAnchor={textAnchor(angle)} dominantBaseline="middle">
        <tspan className="mark" x={spot[0]} dy="-0.55em">
          {formatMarkLabel(level.label)}
        </tspan>
        <tspan className="mark-name" x={spot[0]} dy="1.25em">
          {level.name}
        </tspan>
      </text>
    </g>
  );
}

function Needle({ angle }: { angle: number }) {
  const tip = polar(GAUGE.r - 24, angle);
  const left = polar(11, angle + 96);
  const right = polar(11, angle - 96);
  const tail = polar(16, angle + 180);
  const points = [tip, right, tail, left].map(p => p.map(n => n.toFixed(1)).join(',')).join(' ');
  return (
    <g>
      <polygon className="needle" points={points} />
      <circle className="hub" cx={GAUGE.cx} cy={GAUGE.cy} r={8} />
    </g>
  );
}

function GaugeCaption({
  levels,
  close,
  phase,
}: {
  levels: IndexLevelMark[];
  close: IndexLatestClose | null;
  phase: Phase;
}) {
  if (!close) {
    const text = phase === 'error' ? '收盘暂时读不出来' : phase === 'loading' ? '' : '暂无收盘';
    return (
      <text className="delta" x={GAUGE.cx} y={GAUGE.cy + 64} textAnchor="middle">
        {text}
      </text>
    );
  }
  const change = changePct(close.close, close.previousClose);
  const up = (change ?? 0) >= 0;
  return (
    <g>
      <text className="price" x={GAUGE.cx} y={GAUGE.cy + 58} textAnchor="middle">
        {formatClose(close.close)}
      </text>
      <text className="delta" x={GAUGE.cx} y={GAUGE.cy + 82} textAnchor="middle">
        {gapPercentPhrase(close.close, levels)}
      </text>
      <text className="meta" x={GAUGE.cx} y={GAUGE.cy + 102} textAnchor="middle">
        {close.tradeDate} 收盘
        {change != null ? (
          <tspan className={up ? 'up' : 'down'}>
            {` ${up ? '+' : ''}${change.toFixed(2)}%`}
          </tspan>
        ) : null}
      </text>
    </g>
  );
}

function separateLabels(svg: SVGSVGElement) {
  const nodes = Array.from(svg.querySelectorAll('text.num, text.rim')).filter(
    (node): node is SVGTextElement => node instanceof SVGTextElement
  );
  nodes.forEach(pushOutside);
  for (let pass = 0; pass < 12; pass += 1) {
    let moved = false;
    for (let i = 0; i < nodes.length; i += 1) {
      for (let j = i + 1; j < nodes.length; j += 1) {
        if (separatePair(nodes[i], nodes[j])) moved = true;
      }
    }
    if (!moved) break;
  }
}

/** 两枚刻度叠在一起时，把离圆心更远的那枚沿重叠方向推开，再保持在表盘外面。 */
function separatePair(first: SVGTextElement, second: SVGTextElement): boolean {
  const a = first.getBBox();
  const b = second.getBBox();
  const gap = 4;
  const ax = a.x + a.width / 2;
  const ay = a.y + a.height / 2;
  const bx = b.x + b.width / 2;
  const by = b.y + b.height / 2;
  const penX = (a.width + b.width) / 2 + gap - Math.abs(bx - ax);
  const penY = (a.height + b.height) / 2 + gap - Math.abs(by - ay);
  if (penX <= 0 || penY <= 0) return false;
  const da = Math.hypot(ax - GAUGE.cx, ay - GAUGE.cy);
  const db = Math.hypot(bx - GAUGE.cx, by - GAUGE.cy);
  const moveSecond = db >= da;
  const node = moveSecond ? second : first;
  const signX = Math.sign((moveSecond ? bx - ax : ax - bx) || 1);
  const signY = Math.sign((moveSecond ? by - ay : ay - by) || 1);
  const tx = penX <= penY ? signX * (penX + 1) : 0;
  const ty = penX <= penY ? 0 : signY * (penY + 1);
  shiftText(node, tx, ty);
  if (!insideView(node)) {
    shiftText(node, -tx, -ty);
    return false;
  }
  pushOutside(node);
  return true;
}

const VIEW = { x: -28, y: -52, width: 556, height: 500 };

function insideView(node: SVGTextElement): boolean {
  const box = node.getBBox();
  return (
    box.x >= VIEW.x + 2 &&
    box.y >= VIEW.y + 2 &&
    box.x + box.width <= VIEW.x + VIEW.width - 2 &&
    box.y + box.height <= VIEW.y + VIEW.height - 2
  );
}

function pushOutside(node: SVGTextElement) {
  for (let pass = 0; pass < 4; pass += 1) {
    const box = node.getBBox();
    const qx = Math.max(box.x, Math.min(GAUGE.cx, box.x + box.width));
    const qy = Math.max(box.y, Math.min(GAUGE.cy, box.y + box.height));
    const dist = Math.hypot(qx - GAUGE.cx, qy - GAUGE.cy) || 1;
    if (dist >= GAUGE.face + 6) return;
    const push = GAUGE.face + 6 - dist;
    shiftText(node, ((qx - GAUGE.cx) / dist) * push, ((qy - GAUGE.cy) / dist) * push);
  }
}

function shiftText(node: SVGTextElement, tx: number, ty: number) {
  node.setAttribute('x', String(Number(node.getAttribute('x')) + tx));
  node.setAttribute('y', String(Number(node.getAttribute('y')) + ty));
  node.querySelectorAll('tspan').forEach(part => {
    if (part.hasAttribute('x')) part.setAttribute('x', String(Number(part.getAttribute('x')) + tx));
  });
}
