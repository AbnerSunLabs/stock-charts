/**
 * @jest-environment jsdom
 */
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { IndexStrategyCards } from '@/components/index-levels/index-strategy-cards';
import type { TrackingEtf } from '@/lib/supabase/etf-pool-repository';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

// getSession 直接 reject：对应断网时 auth-js 内部 response 为 undefined 的崩溃路径
const getSessionMock = jest.fn();
jest.mock('@/lib/supabase/client', () => ({
  createBrowserSupabaseClient: () => ({
    auth: { getSession: getSessionMock },
  }),
}));

const funds: TrackingEtf[] = [
  { code: '563360', name: 'A500ETF基金', indexCode: '000510.SH' },
];

describe('IndexStrategyCards 会话读取失败兜底', () => {
  let container: HTMLDivElement;
  let root: Root;
  let unhandled: unknown[];
  const onUnhandled = (reason: unknown) => { unhandled.push(reason); };

  beforeAll(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    unhandled = [];
    process.on('unhandledRejection', onUnhandled);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    getSessionMock.mockRejectedValue(new Error('Failed to fetch'));
  });

  afterEach(() => {
    process.off('unhandledRejection', onUnhandled);
    act(() => root.unmount());
    container.remove();
    jest.clearAllMocks();
  });

  it('getSession reject 时组件降级为基础 ETF 卡片，无未处理异常', async () => {
    await act(async () => {
      root.render(createElement(IndexStrategyCards, { funds }));
      // 冲刷 getSession reject → loadStrategyCards catch → setState 的整条微任务链
      await new Promise(resolve => { setTimeout(resolve, 0); });
    });

    // 会话读取确实发生且被 reject：防止组件跳过会话直接空渲染也能混过本用例
    expect(getSessionMock).toHaveBeenCalledTimes(1);

    const card = document.querySelector('[aria-label="跟踪这只指数的 ETF"]');
    expect(card).not.toBeNull();
    expect(card?.textContent).toContain('A500ETF基金');
    expect(card?.textContent).toContain('563360');
    // 降级路径不应渲染任何策略组合卡
    expect(container.querySelector('.grid-shell')).toBeNull();
    expect(unhandled).toEqual([]);
  });
});
