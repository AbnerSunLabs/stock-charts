/** @jest-environment node */

import { GET } from '@/app/api/index-levels/pe/route';
import { fetchCsindexPe } from '@/lib/index-levels/csindex-pe';

jest.mock('@/lib/index-levels/csindex-pe', () => ({ fetchCsindexPe: jest.fn() }));

const mockedFetchCsindexPe = jest.mocked(fetchCsindexPe);
const originalFetch = global.fetch;
const originalNodeEnv = process.env.NODE_ENV;

afterEach(() => {
  global.fetch = originalFetch;
  Object.defineProperty(process.env, 'NODE_ENV', {
    value: originalNodeEnv, configurable: true,
  });
  jest.clearAllMocks();
});

describe('点位跟踪 PE API', () => {
  it('开发环境直连中证失败时，读取线上只读接口并过滤无效估值', async () => {
    Object.defineProperty(process.env, 'NODE_ENV', {
      value: 'development', configurable: true,
    });
    mockedFetchCsindexPe.mockRejectedValue(new Error('TLS connection failed'));
    global.fetch = jest.fn(async () => Response.json({ points: [
      { tradeDate: '2026-01-05', peTtm: 20 },
      { tradeDate: '2026-01-06', peTtm: 0 },
    ] }));

    const response = await GET(new Request('http://localhost/api/index-levels/pe?code=399971.SZ'));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ points: [
      { tradeDate: '2026-01-05', peTtm: 20 },
    ] });
    expect(global.fetch).toHaveBeenCalledWith(
      'https://charts-stock.vercel.app/api/index-levels/pe?code=399971.SZ',
      { cache: 'no-store' },
    );
  });

  it('生产环境直连失败时不请求线上接口，避免回退链循环', async () => {
    Object.defineProperty(process.env, 'NODE_ENV', {
      value: 'production', configurable: true,
    });
    mockedFetchCsindexPe.mockRejectedValue(new Error('TLS connection failed'));
    global.fetch = jest.fn();

    const response = await GET(new Request('http://localhost/api/index-levels/pe?code=399971.SZ'));

    expect(response.status).toBe(502);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
