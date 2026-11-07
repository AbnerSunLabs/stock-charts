import { HomeToolGrid } from '@/components/home/home-tool-grid';
import { HomeFamilyFinanceSection } from '@/components/home/home-family-finance-section';

/**
 * 应用首页：家庭财务分区 + 投研工具网格。
 */
export default function HomePage() {
  return (
    <main className="min-h-screen py-8 px-4 sm:py-12 sm:px-6 lg:px-10 2xl:px-12">
      <div className="w-full max-w-[var(--page-max)] mx-auto animate-[pageFadeIn_0.5s_var(--ease-out-expo)_both]">
        <header className="mb-6 sm:mb-10 pb-4 sm:pb-6 border-b border-[var(--border-subtle)] animate-[pageFadeIn_0.5s_var(--ease-out-expo)_both] pr-12 sm:pr-0">
          <h1 className="font-[var(--font-display)] text-xl sm:text-[1.625rem] font-semibold tracking-tight text-[var(--text-primary)] m-0 mb-2">
            投资研究工具集
          </h1>
          <p className="text-sm text-[var(--text-muted)] m-0">专业数据可视化工具，助力投资决策</p>
        </header>
        <HomeFamilyFinanceSection />
        <HomeToolGrid />
      </div>
    </main>
  );
}
