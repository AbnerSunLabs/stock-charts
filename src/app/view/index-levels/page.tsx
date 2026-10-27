import { IndexLevelTracker } from '@/components/index-levels/index-level-tracker';

/**
 * 指数点位跟踪：现价对照判断点位，原文按日期列出。
 */
export default function IndexLevelsPage() {
  return (
    <>
      <h1 className="sr">点位跟踪</h1>
      <IndexLevelTracker />
    </>
  );
}
