'use client';

import '@/lib/antd-dayjs';
import { App, ConfigProvider } from 'antd';
// 走 es 路径，避开 optimizePackageImports 把 locale 编成 Client Component 顶层 await
import zhCN from 'antd/es/locale/zh_CN';
import type { ThemeConfig } from 'antd';

import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion';

/**
 * 应用级 Ant Design Provider，统一明亮主题的设计 token 与全站动效节奏。
 * 动效时长/曲线与 globals.css 的 --motion-* token 同源（见 docs/motion-system.md）。
 */
export function AntdProvider({ children }: { children: React.ReactNode }) {
  const reducedMotion = usePrefersReducedMotion();

  const motionTokens: ThemeConfig['token'] = {
    // 与 globals.css 的 --motion-duration-micro/small/medium（120/180/240ms）严格同值；
    // large(320ms) 留给 CSS 侧大块入场，antd 浮层最长到 medium
    motionDurationFast: reducedMotion ? '0s' : '0.12s',
    motionDurationMid: reducedMotion ? '0s' : '0.18s',
    motionDurationSlow: reducedMotion ? '0s' : '0.24s',
    motionEaseOut: 'cubic-bezier(0.22, 1, 0.36, 1)',
    motionEaseInOut: 'cubic-bezier(0.25, 0.1, 0.25, 1)',
  };

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: '#2563eb',
          colorBgContainer: '#ffffff',
          colorBgElevated: '#ffffff',
          colorBorder: 'rgba(15, 23, 42, 0.08)',
          colorText: '#0f172a',
          colorTextSecondary: 'rgba(15, 23, 42, 0.72)',
          colorTextTertiary: 'rgba(15, 23, 42, 0.52)',
          borderRadius: 8,
          fontFamily: "'DM Sans', system-ui, sans-serif",
          ...motionTokens,
        },
        components: {
          Card: {
            colorBgContainer: '#ffffff',
            colorBorderSecondary: 'rgba(15, 23, 42, 0.08)',
          },
          Button: {
            colorBgContainer: '#ffffff',
            colorBorder: 'rgba(15, 23, 42, 0.08)',
          },
        },
      }}
    >
      <App>{children}</App>
    </ConfigProvider>
  );
}
