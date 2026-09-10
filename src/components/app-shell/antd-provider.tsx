'use client';

import '@/lib/antd-dayjs';
import { App, ConfigProvider } from 'antd';
// 走 es 路径，避开 optimizePackageImports 把 locale 编成 Client Component 顶层 await
import zhCN from 'antd/es/locale/zh_CN';

/**
 * 应用级 Ant Design Provider，统一明亮主题的设计 token。
 */
export function AntdProvider({ children }: { children: React.ReactNode }) {
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
