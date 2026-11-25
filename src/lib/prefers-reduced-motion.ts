/**
 * 系统"减少动态效果"偏好（全站唯一实现，CSS 侧由 globals.css 的
 * prefers-reduced-motion 兜底块配合）。jsdom 等环境没有 matchMedia 时按无偏好处理。
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
