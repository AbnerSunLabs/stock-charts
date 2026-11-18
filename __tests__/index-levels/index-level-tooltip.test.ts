import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { IndexLevelChart } from '@/components/index-levels/index-level-chart';
import { filterCloseSpan, type CloseSpan } from '@/lib/index-levels/close-series';
import { MEDIA_ETF_TRADES } from '@/lib/index-levels/media-etf-trades';

const POINTS = [
  { tradeDate: '2010-01-05', close: 100, peTtm: 10 },
  { tradeDate: '2016-01-05', close: 200, peTtm: 20 },
  { tradeDate: '2021-01-05', close: 80, peTtm: 30 },
  { tradeDate: '2026-01-05', close: 120, peTtm: 15 },
];

describe('指数悬停', () => {
  let container: HTMLDivElement;
  let root: Root;
  const originalResizeObserver = global.ResizeObserver;

  beforeAll(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    global.ResizeObserver = class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    };
    jest.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1000);
    jest.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(420);
    jest.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 0, y: 0, left: 0, top: 0, right: 1000, bottom: 420,
      width: 1000, height: 420, toJSON: () => ({}),
    });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    global.ResizeObserver = originalResizeObserver;
    jest.restoreAllMocks();
  });

  function hoverLatest(): HTMLElement {
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    act(() => {
      for (const type of ['mousemove', 'pointermove']) {
        svg!.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX: 943, clientY: 240 }));
      }
    });
    const tip = container.querySelector<HTMLElement>('.tip.show');
    expect(tip).not.toBeNull();
    return tip!;
  }

  it('点击时间胶囊后，累计文案和数值随所选范围更新', () => {
    act(() => root.render(createElement(IndexLevelChart, {
      name: '中证传媒', code: '399971.SZ', points: POINTS, peHistory: POINTS, phase: 'ready',
    })));
    const cases = [
      { tab: '近 5 年', label: '5年累计涨跌', change: '+50.00%' },
      { tab: '近 10 年', label: '10年累计涨跌', change: '-40.00%' },
      { tab: '上市以来', label: '上市以来累计涨跌', change: '+20.00%' },
    ];
    for (const item of cases) {
      const button = Array.from(container.querySelectorAll('button')).find(node => node.textContent === item.tab);
      act(() => button!.click());
      const tip = hoverLatest();
      expect(tip.textContent).toContain(item.label);
      expect(tip.textContent).toContain(item.change);
      expect(tip.textContent).toContain('历史分位: 50.00%');
      expect(tip.textContent).toContain('市盈五年均值: 22.50');
    }
  });

  it.each<CloseSpan>(['5', '10', 'all'])(
    '页面传入已切片的 %s 范围时，悬停使用同一时间文案',
    span => {
      act(() => root.render(createElement(IndexLevelChart, {
        bare: true, presliced: true, name: '中证传媒', code: '399971.SZ',
        points: filterCloseSpan(POINTS, span), peHistory: POINTS, phase: 'ready', span,
      })));
      const tip = hoverLatest();
      expect(tip.textContent).toContain(span === 'all' ? '上市以来累计涨跌' : `${span}年累计涨跌`);
    },
  );

  it('隐藏市盈率后仍保留当前时间范围的收盘提示', () => {
    act(() => root.render(createElement(IndexLevelChart, {
      name: '中证传媒', code: '399971.SZ', points: POINTS, peHistory: POINTS, phase: 'ready',
    })));
    const button = Array.from(container.querySelectorAll('button')).find(node => node.textContent?.trim() === '市盈率');
    act(() => button!.click());
    const tip = hoverLatest();
    expect(tip.textContent).toContain('5年累计涨跌');
    expect(tip.textContent).not.toContain('历史分位');
  });

  it('触屏点选后保留日期提示，切换时间范围时清除旧提示', () => {
    act(() => root.render(createElement(IndexLevelChart, {
      name: '中证传媒', code: '399971.SZ', points: POINTS, peHistory: POINTS, phase: 'ready',
    })));
    const svg = container.querySelector('svg')!;
    act(() => {
      for (const type of ['pointerdown', 'pointerout']) {
        const event = new MouseEvent(type, { bubbles: true, clientX: 943, clientY: 240 });
        Object.defineProperty(event, 'pointerType', { value: 'touch' });
        svg.dispatchEvent(event);
      }
    });
    expect(container.querySelector('.tip')?.textContent).toContain('2026-01-05');
    expect(svg.classList.contains('dragging')).toBe(false);
    const button = Array.from(container.querySelectorAll('button')).find(node => node.textContent === '近 10 年');
    act(() => button!.click());
    expect(container.querySelector('.tip')).toBeNull();
  });

  it('ETF 悬停保留成交价精度和买点说明', () => {
    act(() => root.render(createElement(IndexLevelChart, {
      name: '传媒ETF', code: '512980', phase: 'ready', priceDigits: 3,
      points: [
        { tradeDate: '2020-12-15', close: 0.95 },
        { tradeDate: '2020-12-16', close: 0.945 },
      ],
      marks: MEDIA_ETF_TRADES,
    })));
    const tip = hoverLatest();
    expect(tip.textContent).toContain('历史累计涨跌');
    expect(tip.textContent).toContain('0.945');
    expect(tip.textContent).toContain('买入 B');
    expect(tip.textContent).toContain('24.82 倍');
    expect(tip.textContent).toContain('首笔');
  });

  it('切换指数后不沿用上一只指数的触屏提示', () => {
    const props = { name: '中证传媒', code: '399971.SZ', points: POINTS, peHistory: POINTS, phase: 'ready' as const };
    act(() => root.render(createElement(IndexLevelChart, props)));
    const event = new MouseEvent('pointerdown', { bubbles: true, clientX: 943, clientY: 240 });
    Object.defineProperty(event, 'pointerType', { value: 'touch' });
    act(() => container.querySelector('svg')!.dispatchEvent(event));
    expect(container.querySelector('.tip')).not.toBeNull();
    act(() => root.render(createElement(IndexLevelChart, {
      ...props, name: '沪深300', code: '000300.SH', phase: 'loading', points: [],
    })));
    act(() => root.render(createElement(IndexLevelChart, {
      ...props, name: '沪深300', code: '000300.SH',
    })));
    expect(container.querySelector('.tip')).toBeNull();
  });

  it('完整提示高于手机图表时向上展开，卡片底部保持可见', () => {
    jest.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(272);
    jest.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(363);
    jest.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(352);
    jest.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 0, y: 321, left: 0, top: 321, right: 1000, bottom: 673,
      width: 1000, height: 352, toJSON: () => ({}),
    });
    act(() => root.render(createElement(IndexLevelChart, {
      name: '中证传媒', code: '399971.SZ', points: POINTS, peHistory: POINTS, phase: 'ready',
    })));
    const tip = hoverLatest();
    const top = Number.parseFloat(tip.style.top);
    expect(321 + top).toBeGreaterThanOrEqual(0);
    expect(top + tip.offsetHeight).toBeLessThanOrEqual(352);
    expect(321 + top + tip.offsetHeight).toBeLessThanOrEqual(window.innerHeight);
  });
});
