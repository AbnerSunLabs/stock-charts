'use client';

import { Modal, Button, Typography, App } from 'antd';
import { GithubOutlined } from '@ant-design/icons';
import { signInWithGitHub } from '@/lib/supabase/auth';
import { useState } from 'react';

const { Paragraph } = Typography;

/** 家庭财务默认登录标题（未传 title 时） */
export const DEFAULT_LOGIN_MODAL_TITLE = '登录以使用家庭财务';

/** 家庭财务默认登录说明（未传 description 时） */
export const DEFAULT_LOGIN_MODAL_DESCRIPTION =
  '本工具仅限家庭账号使用。请使用已授权的 GitHub 账号登录。';

export interface LoginModalProps {
  open: boolean;
  onClose: () => void;
  /** 登录成功后希望回到的路径 */
  redirectTo?: string;
  /** 弹窗标题；默认家庭财务文案 */
  title?: string;
  /** 弹窗说明；默认家庭财务文案 */
  description?: string;
}

/**
 * GitHub OAuth 登录弹窗（标题/说明可覆盖；默认保留家庭财务文案）。
 */
export function LoginModal({
  open,
  onClose,
  redirectTo,
  title = DEFAULT_LOGIN_MODAL_TITLE,
  description = DEFAULT_LOGIN_MODAL_DESCRIPTION,
}: LoginModalProps) {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    try {
      const { error } = await signInWithGitHub(redirectTo);
      if (error) {
        message.error(error.message);
        setLoading(false);
      }
      // 成功时会整页跳转，无需关 Modal
    } catch (e) {
      message.error(e instanceof Error ? e.message : '登录失败');
      setLoading(false);
    }
  };

  return (
    <Modal
      title={title}
      open={open}
      onCancel={onClose}
      footer={null}
      destroyOnHidden
      centered
    >
      <Paragraph type="secondary" className="mb-4">
        {description}
      </Paragraph>
      <Button
        type="primary"
        block
        size="large"
        icon={<GithubOutlined />}
        loading={loading}
        onClick={() => void handleLogin()}
      >
        使用 GitHub 登录
      </Button>
    </Modal>
  );
}
