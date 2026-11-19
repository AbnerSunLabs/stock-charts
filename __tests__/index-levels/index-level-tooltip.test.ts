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

  it('加载失败时显示错误说明，不绘制只有点位的折线', () => {
    act(() => root.render(createElement(IndexLevelChart, {
      name: '中证传媒', code: '399971.SZ', points: POINTS,
      phase: 'error', errorLabel: '点位或市盈率暂时读不出来',
    })));

    expect(container.querySelector('.chart-error')?.textContent).toBe('点位或市盈率暂时读不出来');
    expect(container.querySelector('svg.chart')).toBeNull();
  });

  it('点击时间胶囊后，累计涨跌显示实际基准日期和对应数值', () => {
    act(() => root.render(createElement(IndexLevelChart, {
      name: '中证传媒', code: '399971.SZ', points: POINTS, peHistory: POINTS, phase: 'ready',
    })));
    const cases = [
      { tab: '近 5 年', label: '自2021-01-05以来累计涨跌', change: '+50.00%' },
      { tab: '近 10 年', label: '自2016-01-05以来累计涨跌', change: '-40.00%' },
      { tab: '有记录以来', label: '自2010-01-05以来累计涨跌', change: '+20.00%' },
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
      const baseDate = span === 'all' ? '2010-01-05' : span === '10' ? '2016-01-05' : '2021-01-05';
      expect(tip.textContent).toContain(`自${baseDate}以来累计涨跌`);
    },
  );

  it('近五年只用所选区间最高点，忽略窗口外更早的高点', () => {
    act(() => root.render(createElement(IndexLevelChart, {
      bare: true, presliced: true, name: '中证传媒', code: '399971.SZ',
      points: filterCloseSpan(POINTS, '5'),
      phase: 'ready', span: '5',
    })));

    const tip = hoverLatest();
    expect(tip.textContent).toContain('距离最高点（2026-01-05）:0.00%');
  });

  it('悬停区间早期日期时，仍以整个所选区间的最高点为基准', () => {
    act(() => root.render(createElement(IndexLevelChart, {
      bare: true, presliced: true, name: '中证传媒', code: '399971.SZ',
      points: filterCloseSpan(POINTS, '5'), phase: 'ready', span: '5',
    })));
    const svg = container.querySelector('svg')!;
    act(() => svg.dispatchEvent(new MouseEvent('pointermove', {
      bubbles: true, clientX: 53, clientY: 240,
    })));

    expect(container.querySelector('.tip.show')?.textContent)
      .toContain('距离最高点（2026-01-05）:-33.33%');
  });

  it('悬停在区间中途时，明确显示区间起点而非完整五年收益', () => {
    act(() => root.render(createElement(IndexLevelChart, {
      name: '中证传媒', code: '399971.SZ', phase: 'ready',
      points: [
        { tradeDate: '2021-01-05', close: 80 },
        { tradeDate: '2023-01-05', close: 100 },
        { tradeDate: '2026-01-05', close: 120 },
      ],
    })));
    const svg = container.querySelector('svg')!;
    act(() => svg.dispatchEvent(new MouseEvent('pointermove', {
      bubbles: true, clientX: 408, clientY: 240,
    })));
    const tip = container.querySelector<HTMLElement>('.tip.show')!;
    expect(tip.textContent).toContain('2023-01-05');
    expect(tip.textContent).toContain('自2021-01-05以来累计涨跌');
    expect(tip.textContent).toContain('+25.00%');
  });

  it('缩放后累计涨跌仍以所选范围的首个交易日为基准', () => {
    const points = Array.from({ length: 20 }, (_, index) => ({
      tradeDate: `${2007 + index}-01-05`, close: 100 + index,
    }));
    act(() => root.render(createElement(IndexLevelChart, {
      name: '中证传媒', code: '399971.SZ', points, phase: 'ready', span: 'all',
    })));
    const hoverLastPoint = () => {
      act(() => container.querySelector('svg')!.dispatchEvent(new MouseEvent('pointermove', {
        bubbles: true, clientX: 975, clientY: 240,
      })));
      return container.querySelector<HTMLElement>('.tip.show')!;
    };
    expect(hoverLastPoint().textContent).toContain('自2007-01-05以来累计涨跌:+19.00%');
    act(() => container.querySelector('svg')!.dispatchEvent(new WheelEvent('wheel', {
      bubbles: true, cancelable: true, clientX: 943, deltaY: -100,
    })));
    expect(hoverLastPoint().textContent).toContain('自2007-01-05以来累计涨跌:+19.00%');
  });

  it('缩放隐藏区间最高点后，距离最高点仍使用整个所选区间', () => {
    const points = Array.from({ length: 20 }, (_, index) => ({
      tradeDate: `${2007 + index}-01-05`, close: 200 - index * 5,
    }));
    act(() => root.render(createElement(IndexLevelChart, {
      name: '中证传媒', code: '399971.SZ', points, phase: 'ready', span: 'all',
    })));
    const svg = container.querySelector('svg')!;
    act(() => svg.dispatchEvent(new WheelEvent('wheel', {
      bubbles: true, cancelable: true, clientX: 943, deltaY: -100,
    })));
    act(() => svg.dispatchEvent(new MouseEvent('pointermove', {
      bubbles: true, clientX: 975, clientY: 240,
    })));

    expect(container.querySelector('.tip.show')?.textContent)
      .toContain('距离最高点（2007-01-05）:-47.50%');
  });

  it('隐藏市盈率后仍保留当前时间范围的收盘提示', () => {
    act(() => root.render(createElement(IndexLevelChart, {
      name: '中证传媒', code: '399971.SZ', points: POINTS, peHistory: POINTS, phase: 'ready',
    })));
    const button = Array.from(container.querySelectorAll('button')).find(node => node.textContent?.trim() === '市盈率');
    act(() => button!.click());
    const tip = hoverLatest();
    expect(tip.textContent).toContain('自2021-01-05以来累计涨跌');
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
    expect(tip.textContent).toContain('自2020-12-15以来累计涨跌');
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
