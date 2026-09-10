'use client';

import '@/lib/antd-dayjs';
import { App, ConfigProvider } from 'antd';

interface GridAntdProviderProps {
  children: React.ReactNode;
}

/**
 * 网格页专用 Ant Design 配置（Coinbase 浅色 token）。
 */
export function GridAntdProvider({ children }: GridAntdProviderProps) {
  return (
    <ConfigProvider
      theme={{
        token: {
          borderRadius: 12,
          colorPrimary: '#0052ff',
          colorPrimaryHover: '#003ecc',
          colorPrimaryActive: '#003ecc',
          colorText: '#0a0b0d',
          colorTextSecondary: '#5b616e',
          colorBorder: '#dee1e6',
          colorBgContainer: '#ffffff',
          zIndexPopupBase: 10000,
          colorBgSpotlight: '#ffffff',
          colorTextLightSolid: '#ffffff',
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif',
        },
        components: {
          InputNumber: {
            controlHeight: 48,
            fontSize: 16,
            fontWeightStrong: 600,
          },
          Button: {
            controlHeightLG: 44,
            borderRadiusLG: 999,
            fontWeight: 600,
          },
          Drawer: {
            paddingLG: 24,
          },
        },
      }}
    >
      <App>{children}</App>
    </ConfigProvider>
  );
}
