import {
  DEFAULT_LOGIN_MODAL_DESCRIPTION,
  DEFAULT_LOGIN_MODAL_TITLE,
} from '@/components/auth/login-modal';
import { checkFamilyAccess, normalizeOAuthRedirectPath } from '@/lib/supabase/auth';
import type { SupabaseClient } from '@supabase/supabase-js';

/** 构造可控的 Supabase 客户端替身：getSession 返回固定会话，rpc 返回注入结果 */
function makeFakeClient(rpcResult: { data: unknown; error: unknown } | Error): Pick<SupabaseClient, 'auth' | 'rpc'> {
  return {
    auth: {
      getSession: async () => ({
        data: { session: { access_token: 't', user: { id: 'u1' } } },
      }),
    } as never,
    rpc: async () => {
      if (rpcResult instanceof Error) throw rpcResult;
      return rpcResult;
    },
  } as never;
}

describe('normalizeOAuthRedirectPath', () => {
  it('未传 redirectTo 时保留当前站内路径、查询和 hash', () => {
    expect(
      normalizeOAuthRedirectPath(undefined, {
        pathname: '/view/family/policies',
        search: '?page=2',
        hash: '#active',
      })
    ).toBe('/view/family/policies?page=2#active');
  });

  it('拒绝站外或非法回跳地址', () => {
    expect(normalizeOAuthRedirectPath('https://evil.example')).toBe('/view/family');
    expect(normalizeOAuthRedirectPath('//evil.example')).toBe('/view/family');
    expect(normalizeOAuthRedirectPath('/\\evil.example')).toBe('/view/family');
  });
});

describe('LoginModal 默认文案', () => {
  it('未传 title/description 时保留家庭财务文案', () => {
    expect(DEFAULT_LOGIN_MODAL_TITLE).toBe('登录以使用家庭财务');
    expect(DEFAULT_LOGIN_MODAL_DESCRIPTION).toContain('家庭账号');
    expect(DEFAULT_LOGIN_MODAL_DESCRIPTION).toContain('已授权');
  });
});

describe('checkFamilyAccess 失败分流', () => {
  it('RPC 请求失败标记为 error：会话保留，调用方不得据此登出', async () => {
    const result = await checkFamilyAccess(
      makeFakeClient(new Error('network down')) as never
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('error');
    expect(result.session).not.toBeNull();
  });

  it('RPC 明确拒绝标记为 denied', async () => {
    const result = await checkFamilyAccess(
      makeFakeClient({ data: false, error: null }) as never
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('denied');
  });

  it('RPC 正常放行时 allowed 为 true', async () => {
    const result = await checkFamilyAccess(
      makeFakeClient({ data: true, error: null }) as never
    );
    expect(result.allowed).toBe(true);
    expect(result.reason).toBeUndefined();
  });
});
