import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ViewBreadcrumb } from '@/components/navigation/view-breadcrumb';

export const metadata: Metadata = {
  robots: 'noindex, nofollow',
};

/**
 * 分析视图通用布局：提供面包屑与主内容区域。
 */
export default function ViewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-[var(--bg-main)]" id="view-layout-root">
      <main className="flex-1 w-full overflow-auto py-6 px-4 sm:py-8 sm:px-6 lg:px-10 2xl:px-12">
        <Suspense fallback={null}>
          <ViewBreadcrumb />
        </Suspense>
        {children}
      </main>
    </div>
  );
}
