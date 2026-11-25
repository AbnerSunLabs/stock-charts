'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Spin, Result, Button, App } from 'antd';
import type { User } from '@supabase/supabase-js';
import { checkFamilyAccess, signOut } from '@/lib/supabase/auth';
import { LoginModal } from './login-modal';
import { UserMenu } from './user-menu';

export interface AuthGateProps {
  children: ReactNode;
  /** 未登录时 OAuth 回跳路径 */
  redirectPath: string;
}

type GateState =
  | { status: 'loading' }
  | { status: 'need_login' }
  | { status: 'denied' }
  | { status: 'check_failed' }
  | { status: 'allowed'; user: User };

/**
 * 家庭财务门禁：需有效 session + 白名单。
 */
export function AuthGate({ children, redirectPath }: AuthGateProps) {
  const { message } = App.useApp();
  const [state, setState] = useState<GateState>({ status: 'loading' });
  const [loginOpen, setLoginOpen] = useState(false);

  const refresh = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      const result = await checkFamilyAccess();
      if (result.reason === 'error') {
        // 校验请求失败（含会话查询失败）：保留会话，给出重试，不误报"无权限"
        setState({ status: 'check_failed' });
        setLoginOpen(false);
        return;
      }
      if (!result.session) {
        setState({ status: 'need_login' });
        setLoginOpen(true);
        return;
      }
      if (!result.allowed) {
        message.warning('当前 GitHub 账号无家庭财务访问权限');
        await signOut();
        setState({ status: 'denied' });
        setLoginOpen(false);
        return;
      }
      setState({ status: 'allowed', user: result.user! });
      setLoginOpen(false);
    } catch {
      setState({ status: 'check_failed' });
      setLoginOpen(false);
    }
  }, [message]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (state.status === 'check_failed') {
    return (
      <Result
        status="warning"
        title="暂时无法验证家庭财务权限"
        subTitle="网络或服务暂时不可用，你的登录状态未受影响。"
        extra={
          <Button type="primary" onClick={() => void refresh()}>
            重试
          </Button>
        }
      />
    );
  }

  if (state.status === 'loading') {
    return (
      <div className="flex justify-center py-24">
        <Spin size="large" tip="校验登录…" />
      </div>
    );
  }

  if (state.status === 'denied') {
    return (
      <>
        <Result
          status="403"
          title="无访问权限"
          subTitle="请使用已加入白名单的 GitHub 账号登录。"
          extra={
            <Button type="primary" onClick={() => setLoginOpen(true)}>
              重新登录
            </Button>
          }
        />
        <LoginModal
          open={loginOpen}
          onClose={() => setLoginOpen(false)}
          redirectTo={redirectPath}
        />
      </>
    );
  }

  if (state.status === 'need_login') {
    return (
      <>
        <Result
          status="info"
          title="需要登录"
          subTitle="家庭财务仅对授权账号开放。"
          extra={
            <Button type="primary" onClick={() => setLoginOpen(true)}>
              使用 GitHub 登录
            </Button>
          }
        />
        <LoginModal
          open={loginOpen}
          onClose={() => setLoginOpen(false)}
          redirectTo={redirectPath}
        />
      </>
    );
  }

  return (
    <div>
      <div className="flex justify-end mb-3">
        <UserMenu user={state.user} onSignedOut={() => void refresh()} />
      </div>
      {children}
    </div>
  );
}
