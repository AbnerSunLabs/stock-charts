/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 避免 antd barrel import 在 dev 下生成易失真的 server vendor-chunks
  experimental: {
    optimizePackageImports: ['antd', '@ant-design/charts'],
  },
  // 本地跑生产验证时（PROD_DIST=1）使用独立构建目录，避免与 dev server 共享 .next 互相覆盖
  ...(process.env.PROD_DIST ? { distDir: '.next-prod' } : {}),
};

export default nextConfig;
