'use client';

import { useState } from 'react';
import { Avatar, Dropdown, App } from 'antd';
import { LoadingOutlined, LogoutOutlined } from '@ant-design/icons';
import type { MenuProps } from 'antd';
import type { User } from '@supabase/supabase-js';
import { signOut } from '@/lib/supabase/auth';

export interface UserMenuProps {
  user: User;
  onSignedOut?: () => void;
}

/**
 * 已登录用户菜单（头像 + 退出）。
 */
export function UserMenu({ user, onSignedOut }: UserMenuProps) {
  const { message } = App.useApp();
  const [loggingOut, setLoggingOut] = useState(false);
  const meta = user.user_metadata ?? {};
  const avatarUrl = typeof meta.avatar_url === 'string' ? meta.avatar_url : undefined;
  const name =
    (typeof meta.user_name === 'string' && meta.user_name) ||
    (typeof meta.preferred_username === 'string' && meta.preferred_username) ||
    user.email ||
    '已登录';

  const items: MenuProps['items'] = [
    {
      key: 'user',
      label: name,
      disabled: true,
    },
    { type: 'divider' },
    {
      key: 'logout',
      icon: loggingOut ? <LoadingOutlined /> : <LogoutOutlined />,
      label: loggingOut ? '退出中…' : '退出登录',
      disabled: loggingOut,
      onClick: async () => {
        // 状态变化：点击退出→网络请求期间该项立即禁用并切换为进行中文案+加载图标，
        // 防止连点重复触发登出；成功后再进入门禁复核流转
        setLoggingOut(true);
        try {
          await signOut();
          message.success('已退出登录');
          onSignedOut?.();
        } catch {
          message.error('退出登录失败，请重试');
        } finally {
          setLoggingOut(false);
        }
      },
    },
  ];

  return (
    <Dropdown menu={{ items }} placement="bottomRight">
      <button
        type="button"
        className="inline-flex items-center gap-2 border-0 bg-transparent cursor-pointer p-0"
        aria-label="用户菜单"
      >
        <Avatar size="small" src={avatarUrl}>
          {name.slice(0, 1).toUpperCase()}
        </Avatar>
        <span className="text-sm text-[var(--text-secondary)] hidden sm:inline">{name}</span>
      </button>
    </Dropdown>
  );
}
