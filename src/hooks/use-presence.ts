'use client';

import { useEffect, useState } from 'react';

/**
 * 弹层在场控制：open 变 false 时先切到不可见态播放退场过渡，
 * 等退场时长结束后再真正卸载，避免"关闭瞬间整块消失"。
 * 进场用双 requestAnimationFrame 确保初始（隐藏）样式已提交后再切换，
 * 过渡才能可靠触发；系统开启"减少动态效果"时跳过等待、立即卸载。
 */
export function usePresence(
  open: boolean,
  exitMs: number
): { mounted: boolean; visible: boolean } {
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const raf = requestAnimationFrame(() =>
        requestAnimationFrame(() => setVisible(true))
      );
      return () => cancelAnimationFrame(raf);
    }
    setVisible(false);
    // jsdom 等环境没有 matchMedia，按"无偏好"处理（走定时器卸载）
    if (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      setMounted(false);
      return undefined;
    }
    const timer = window.setTimeout(() => setMounted(false), exitMs);
    return () => window.clearTimeout(timer);
    // mounted 不入依赖：本效应只对 open 的边沿负责
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, exitMs]);

  return { mounted, visible };
}
