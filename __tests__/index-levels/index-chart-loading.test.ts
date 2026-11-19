import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { IndexLevelTracker } from '@/components/index-levels/index-level-tracker';
import { attachIndexPe } from '@/lib/index-levels/pe-series';
import { fetchIndexCloseSeries } from '@/lib/supabase/index-daily-repository';

jest.mock('next/navigation', () => ({
  usePathname: () => '/view/index-levels',
  useRouter: () => ({ replace: jest.fn() }),
  useSearchParams: () => new URLSearchParams('index=000905.SH'),
}));
jest.mock('@/lib/supabase/client', () => ({ createBrowserSupabaseClient: () => ({}) }));
jest.mock('@/lib/supabase/index-daily-repository', () => ({ fetchIndexCloseSeries: jest.fn() }));
jest.mock('@/lib/index-levels/pe-series', () => ({
  ...jest.requireActual('@/lib/index-levels/pe-series'),
  attachIndexPe: jest.fn(),
}));
jest.mock('@/hooks/use-etf-journal-marks', () => ({
  useEtfJournalMarks: () => ({ status: 'signed-out' }),
}));
jest.mock('@/components/index-levels/index-level-chart', () => ({
  IndexLevelChart: ({ code, phase, points }: {
    code: string;
    phase: string;
    points: Array<{ peTtm?: number }>;
  }) => require('react').createElement('div', {
    'data-chart-code': code,
    'data-phase': phase,
    'data-pe-count': points.filter(point => point.peTtm != null).length,
  }),
}));

const mockFetchIndexCloseSeries = jest.mocked(fetchIndexCloseSeries);
const mockAttachIndexPe = jest.mocked(attachIndexPe);
const closes = [
  { tradeDate: '2026-01-05', close: 1000 },
  { tradeDate: '2026-01-06', close: 1010 },
];

describe('指数折线加载时序', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeAll(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    mockFetchIndexCloseSeries.mockResolvedValue(closes);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    jest.clearAllMocks();
  });

  const chart = () => document.querySelector<HTMLElement>('[data-chart-code="000905.SH"]');

  it('点位先到时仍保持加载，市盈率到齐后才进入 ready', async () => {
    let resolvePe!: (points: typeof closes & Array<{ peTtm?: number }>) => void;
    mockAttachIndexPe.mockReturnValue(new Promise(resolve => { resolvePe = resolve; }));

    await act(async () => {
      root.render(createElement(IndexLevelTracker));
      await Promise.resolve();
    });
    expect(chart()?.dataset.phase).toBe('loading');
    expect(chart()?.dataset.peCount).toBe('0');

    await act(async () => {
      resolvePe(closes.map((point, index) => ({ ...point, peTtm: 20 + index })));
    });
    expect(chart()?.dataset.phase).toBe('ready');
    expect(chart()?.dataset.peCount).toBe('2');
  });

  it('市盈率请求结束但没有有效值时显示错误，不显示单条点位线', async () => {
    mockAttachIndexPe.mockResolvedValue(closes);
    await act(async () => {
      root.render(createElement(IndexLevelTracker));
      await Promise.resolve();
    });

    expect(chart()?.dataset.phase).toBe('error');
  });

  it('只有一个市盈率点、无法构成折线时也不显示点位图', async () => {
    mockAttachIndexPe.mockResolvedValue([
      { ...closes[0], peTtm: 20 },
      closes[1],
    ]);
    await act(async () => {
      root.render(createElement(IndexLevelTracker));
      await Promise.resolve();
    });

    expect(chart()?.dataset.phase).toBe('error');
  });
});
