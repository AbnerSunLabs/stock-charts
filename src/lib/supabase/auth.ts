import type { Session, User, SupabaseClient } from '@supabase/supabase-js';
import { createBrowserSupabaseClient } from './client';

export interface FamilyAccessResult {
  allowed: boolean;
  session: Session | null;
  user: User | null;
  /** denied = 白名单明确拒绝；error = 校验请求本身失败（网络/服务），不应据此登出会话 */
  reason?: 'denied' | 'error';
}

interface OAuthLocation {
  pathname: string;
  search: string;
  hash: string;
}

/** 只允许站内相对路径，避免 OAuth 回跳到外部站点。 */
export function normalizeOAuthRedirectPath(
  redirectTo?: string,
  currentLocation?: OAuthLocation
): string {
  const candidate =
    redirectTo ??
    (currentLocation
      ? `${currentLocation.pathname}${currentLocation.search}${currentLocation.hash}`
      : '/view/family');

  return candidate.startsWith('/') &&
    !candidate.startsWith('//') &&
    !candidate.includes('\\') &&
    !candidate.includes('://')
    ? candidate
    : '/view/family';
}

/**
 * 发起 GitHub OAuth；完成后回跳 redirectTo（默认当前页）。
 */
export async function signInWithGitHub(redirectTo?: string): Promise<{ error: Error | null }> {
  const supabase = createBrowserSupabaseClient();
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const next = normalizeOAuthRedirectPath(
    redirectTo,
    typeof window !== 'undefined' ? window.location : undefined
  );
  const callback = `${origin}/auth/callback?next=${encodeURIComponent(next)}`;

  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'github',
    options: {
      redirectTo: callback,
    },
  });
  return { error: error ? new Error(error.message) : null };
}

/** 登出当前 session。 */
export async function signOut(): Promise<void> {
  const supabase = createBrowserSupabaseClient();
  await supabase.auth.signOut();
}

/** 获取当前浏览器 session。 */
export async function getBrowserSession(): Promise<Session | null> {
  const supabase = createBrowserSupabaseClient();
  const { data } = await supabase.auth.getSession();
  return data.session;
}

/**
 * 调用白名单 RPC；fail-closed（错误/空 → false）。
 */
export async function checkFamilyAccess(
  client?: SupabaseClient
): Promise<FamilyAccessResult> {
  const supabase = client ?? createBrowserSupabaseClient();
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    // 会话查询失败（如 token 刷新的网络故障）：可重试故障，不引导用户重新登录
    return { allowed: false, session: null, user: null, reason: 'error' };
  }
  if (!session?.user) {
    return { allowed: false, session: null, user: null };
  }

  // rpc 的网络异常可能以 reject 形式抛出，这里统一归一为 error 语义，
  // 保证本函数对调用方是完整契约：临时故障一律 reason:'error'，绝不抛出
  let data: unknown = null;
  let rpcError: unknown = null;
  try {
    const res = await supabase.rpc('is_family_access_allowed');
    data = res.data;
    rpcError = res.error;
  } catch (e) {
    rpcError = e;
  }
  if (rpcError) {
    // fail-closed 依旧拦截内容，但调用方不得把临时故障当作"无权限"处理（如登出）
    return { allowed: false, session, user: session.user, reason: 'error' };
  }
  if (data !== true) {
    return { allowed: false, session, user: session.user, reason: 'denied' };
  }
  return { allowed: true, session, user: session.user };
}
