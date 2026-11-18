import { quoteSource } from '@/lib/index-levels/catalog';

describe('quoteSource', () => {
  it('且慢域名用且慢图标，微博和其他地址用微博图标', () => {
    expect(quoteSource('https://qieman.com/content/content-detail?postId=92155')).toBe('qieman');
    expect(quoteSource('https://cdn2.qieman.com/static/favicon.ico')).toBe('qieman');
    expect(quoteSource('https://weibo.com/7519797263/MoAOqBxZT')).toBe('weibo');
    expect(quoteSource('not a url')).toBe('weibo');
  });
});
