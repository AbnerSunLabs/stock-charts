import { useGSAP } from '@gsap/react';
import { gsap } from 'gsap';
import { Flip } from 'gsap/Flip';

/**
 * 全站 GSAP 动效收口：统一注册插件与默认值，业务组件禁止再手写
 * registerPlugin 与 matchMedia 检测。数值与 docs/motion-system.md 的 CSS token 同源。
 */
gsap.registerPlugin(useGSAP, Flip);

/** 动效常量（秒），与 globals.css 的 --motion-* token 保持同值 */
export const MOTION = {
  duration: { micro: 0.12, small: 0.18, medium: 0.24, large: 0.32 },
  exit: { small: 0.14, medium: 0.18, large: 0.24 },
  ease: {
    out: 'power3.out',
    standard: 'power2.inOut',
    spring: 'back.out(1.25)',
    in: 'power2.in',
  },
  stagger: { item: 0.03, card: 0.04, maxTotal: 0.18 },
} as const;

gsap.defaults({
  duration: MOTION.duration.medium,
  ease: MOTION.ease.out,
  overwrite: 'auto',
});

/**
 * 是否偏好减少动态效果。仅用于一次性判断（事件处理器、图表配置）；
 * 组件内响应式渲染请用 usePrefersReducedMotion。
 * @returns 系统开启「减少动态效果」时为 true；服务端渲染恒为 false
 */
export function isReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
