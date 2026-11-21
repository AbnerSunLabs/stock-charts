import { ImageResponse } from 'next/og';

export const alt = '仓位分布旭日图';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/**
 * 生成旭日图视图的 Open Graph 分享图。
 */
export default async function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(145deg, #f8fafc 0%, #e2e8f0 100%)',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 24,
            padding: 48,
          }}
        >
          <div
            style={{
              fontSize: 56,
              fontWeight: 700,
              color: '#0f172a',
              letterSpacing: '-0.02em',
            }}
          >
            Sunburst Allocation
          </div>
          <div
            style={{
              fontSize: 28,
              color: '#475569',
              fontWeight: 500,
            }}
          >
            Portfolio Structure Visualization
          </div>
          <div
            style={{
              width: 320,
              height: 320,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 50%, #1d4ed8 100%)',
              opacity: 0.9,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: 24,
              boxShadow: '0 25px 50px -12px rgba(59, 130, 246, 0.35)',
            }}
          >
            <div
              style={{
                width: 200,
                height: 200,
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div
                style={{
                  width: 100,
                  height: 100,
                  borderRadius: '50%',
                  background: 'rgba(255,255,255,0.4)',
                }}
              />
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
