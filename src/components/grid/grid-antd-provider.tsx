'use client';

import '@/lib/antd-dayjs';
import { App, ConfigProvider } from 'antd';

import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion';

interface GridAntdProviderProps {
  children: React.ReactNode;
}

/**
 * 网格页专用 Ant Design 配置（Coinbase 浅色 token）。
 * 动效 token 继承全站 --motion-* 体系，减少动态效果时置零（见 docs/motion-system.md）。
 */
export function GridAntdProvider({ children }: GridAntdProviderProps) {
  const reducedMotion = usePrefersReducedMotion();

  return (
    <ConfigProvider
      theme={{
        token: {
          // 与 globals.css 的 --motion-duration-micro/small/medium（120/180/240ms）严格同值
          motionDurationFast: reducedMotion ? '0s' : '0.12s',
          motionDurationMid: reducedMotion ? '0s' : '0.18s',
          motionDurationSlow: reducedMotion ? '0s' : '0.24s',
          motionEaseOut: 'cubic-bezier(0.22, 1, 0.36, 1)',
          motionEaseInOut: 'cubic-bezier(0.25, 0.1, 0.25, 1)',
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
