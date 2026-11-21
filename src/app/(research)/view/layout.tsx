import { ResearchShell } from '@/components/research/research-shell';

/**
 * 投研工具布局。家庭财务仍走 app/view/layout，不经过这里。
 */
export default function ResearchViewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ResearchShell>{children}</ResearchShell>;
}
