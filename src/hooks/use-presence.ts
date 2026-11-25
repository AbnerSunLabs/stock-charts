'use client';

import { useEffect, useRef, useState } from 'react';

import { prefersReducedMotion } from '@/lib/prefers-reduced-motion';

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
  // 回调里读最新 open：渲染被并发调度推迟时，迟到的帧不得把已关闭的弹层重新点亮
  const openRef = useRef(open);
  openRef.current = open;

  useEffect(() => {
    if (open) {
      setMounted(true);
      // 两层 rAF 的 id 都要留：只取消外层时，已排队的内层帧仍会执行
      let innerRaf = 0;
      const outerRaf = requestAnimationFrame(() => {
        innerRaf = requestAnimationFrame(() => {
          if (openRef.current) setVisible(true);
        });
      });
      return () => {
        cancelAnimationFrame(outerRaf);
        cancelAnimationFrame(innerRaf);
      };
    }
    setVisible(false);
    if (prefersReducedMotion()) {
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
