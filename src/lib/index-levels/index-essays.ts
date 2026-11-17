import { A500_ESSAYS } from '@/lib/index-levels/a500-essays';

/** 没有判断点位时，贴在指数图右侧的原文。按时间从新到旧。 */
export interface IndexEssay {
  id: string;
  date: string;
  postId: number;
  paragraphs: string[];
  /** 摘录范围说明，不是原文。 */
  note?: string;
}

const INDEX_ESSAYS: Record<string, IndexEssay[]> = {
  '000510.SH': A500_ESSAYS,
};

/** 这只指数要放在右侧的发言。没有时返回空数组。 */
export function essaysForIndex(code: string): IndexEssay[] {
  return INDEX_ESSAYS[code] ?? [];
}

export function essayHref(postId: number): string {
  return `https://qieman.com/content/content-detail?postId=${postId}`;
}
