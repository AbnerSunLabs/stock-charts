/**
 * @jest-environment node
 */

describe('createBrowserSupabaseClient（Node/SSR）', () => {
  const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const originalKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  afterEach(() => {
    if (originalUrl === undefined) {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    } else {
      process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    }
    if (originalKey === undefined) {
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    } else {
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalKey;
    }
    jest.resetModules();
  });

  it('缺少公开环境变量时预渲染不抛错', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    jest.resetModules();
    const { createBrowserSupabaseClient } = await import(
      '@/lib/supabase/client'
    );
    expect(() => createBrowserSupabaseClient()).not.toThrow();
  });
});
