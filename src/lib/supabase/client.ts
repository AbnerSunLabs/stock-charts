import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

let browserClient: SupabaseClient | null = null;

function createSsrStubClient(): SupabaseClient {
  return new Proxy({} as SupabaseClient, {
    get(_target, prop) {
      if (prop === 'then') return undefined;
      throw new Error('Supabase 客户端仅在浏览器使用');
    },
  });
}

/**
 * 浏览器端 Supabase 单例（Auth session 存 cookie/local）。
 * SSR/预渲染不真正建连，避免 CI `next build` 因缺密钥失败。
 */
export function createBrowserSupabaseClient(): SupabaseClient {
  if (typeof window === 'undefined') {
    return createSsrStubClient();
  }

  if (browserClient) return browserClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error('缺少 NEXT_PUBLIC_SUPABASE_URL 或 NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }

  browserClient = createBrowserClient(url, anonKey);
  return browserClient;
}
