/**
 * @jest-environment jsdom
 */
import { GridPortfolioBoard } from '@/components/grid/grid-portfolio-board';
import { GridTradeJournal } from '@/components/grid/grid-trade-journal';
import { runGridCalculation } from '@/lib/grid-run-calculation';
import { validateGridParams } from '@/lib/grid-validate-params';
import { DEFAULT_GRID_PARAMS } from '@/types/grid';
import type { GridStrategyTrade } from '@/types/grid-strategy-trade';
import type { SavedGridStrategyV1 } from '@/types/grid-strategy-storage';
import { App } from 'antd';
import { act, createElement, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';

const trades: GridStrategyTrade[] = [
  {
    id: 'trade-a',
    strategyId: 'strategy-a',
    levelKey: 'level-a',
    side: 'buy',
    price: 1,
    qty: 111,
    tradeDate: '2026-09-28',
    createdAt: '2026-09-28T08:00:00.000Z',
  },
  {
    id: 'trade-b',
    strategyId: 'strategy-b',
    levelKey: 'level-b',
    side: 'buy',
    price: 2,
    qty: 222,
    tradeDate: '2026-09-29',
    createdAt: '2026-09-29T08:00:00.000Z',
  },
];

const resultSnapshot = runGridCalculation(
  DEFAULT_GRID_PARAMS,
  { dynamicGridEnabled: false, dynamicGridMode: 'stable' },
  validateGridParams(DEFAULT_GRID_PARAMS)
);

function strategy(id: string, name: string): SavedGridStrategyV1 {
  return {
    id,
    name,
    symbol: '',
    note: '',
    schemaVersion: 1,
    createdAt: '2026-09-28T08:00:00.000Z',
    updatedAt: '2026-09-29T08:00:00.000Z',
    config: {
      params: DEFAULT_GRID_PARAMS,
      dynamicGridEnabled: false,
      dynamicGridMode: 'stable',
    },
    resultSnapshot,
  };
}

describe('GridTradeJournal', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeAll(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: () => ({
        matches: false,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }),
    });
  });

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('按页面传入的策略筛选值只展示对应卡片的流水', () => {
    act(() => {
      root.render(
        createElement(
          App,
          null,
          createElement(GridTradeJournal, {
            strategies: [],
            trades,
            strategyId: 'strategy-b',
            onStrategyChange: () => undefined,
          })
        )
      );
    });

    expect(container.textContent).toContain('222');
    expect(container.textContent).not.toContain('111');
  });

  it('点击组合卡片的流水后切换并只展示该策略流水', () => {
    function Harness() {
      const [tab, setTab] = useState<'board' | 'journal'>('board');
      const [strategyId, setStrategyId] = useState<string | 'all'>('all');
      const strategies = [
        strategy('strategy-a', '策略 A'),
        strategy('strategy-b', '策略 B'),
      ];

      return tab === 'board'
        ? createElement(GridPortfolioBoard, {
            strategies,
            trades,
            onOpenCalculator: () => undefined,
            onOpenJournal: id => {
              setStrategyId(id);
              setTab('journal');
            },
          })
        : createElement(GridTradeJournal, {
            strategies,
            trades,
            strategyId,
            onStrategyChange: setStrategyId,
          });
    }

    act(() => root.render(createElement(App, null, createElement(Harness))));

    const strategyCard = Array.from(
      container.querySelectorAll<HTMLElement>('.grid-portfolio-card')
    ).find(card => card.textContent?.includes('策略 B'));
    const cardButtons = strategyCard?.querySelectorAll('button');
    expect(cardButtons).toHaveLength(2);
    expect(
      container.querySelector('.grid-portfolio-board__ref')?.getAttribute('href')
    ).toBe('https://ashare.laoqianriritan.com/#panel-valuation');

    act(() =>
      cardButtons?.[1]?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    );

    expect(container.textContent).toContain('222');
    expect(container.textContent).not.toContain('111');
    expect(container.textContent).not.toContain('打开计算器');
  });
});
