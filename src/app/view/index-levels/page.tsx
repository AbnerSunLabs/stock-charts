import { Suspense } from 'react';

import { IndexLevelTracker } from '@/components/index-levels/index-level-tracker';

/**
 * 指数点位跟踪：现价对照判断点位，原文按日期列出。
 * 当前指数在 query `index` 上，读取 searchParams 需要 Suspense。
 */
export default function IndexLevelsPage() {
  return (
    <Suspense fallback={null}>
      <IndexLevelTracker />
    </Suspense>
  );
}
