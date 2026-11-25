'use client';

import { CheckOutlined } from '@ant-design/icons';
import { useGSAP } from '@gsap/react';
import { gsap } from 'gsap';
import { useEffect, useRef, useState } from 'react';

import { prefersReducedMotion } from '@/lib/prefers-reduced-motion';

gsap.registerPlugin(useGSAP);

export interface GridSaveStatusIslandProps {
  label: '保存策略' | '更新策略' | '已保存';
  disabled: boolean;
  loading: boolean;
  reason: string | null;
  onSave: () => void;
}

/**
 * 摘要条保存状态岛：可保存 / 更新 / 进行中 / 已保存，含成功勾选反馈。
 */
export function GridSaveStatusIsland({
  label,
  disabled,
  loading,
  reason,
  onSave,
}: GridSaveStatusIslandProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const checkRef = useRef<HTMLSpanElement>(null);
  const [flashSaved, setFlashSaved] = useState(false);
  const prevLoading = useRef(loading);

  useEffect(() => {
    const wasLoading = prevLoading.current;
    prevLoading.current = loading;
    if (wasLoading && !loading && label === '已保存') {
      setFlashSaved(true);
      const timer = window.setTimeout(() => setFlashSaved(false), 500);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [loading, label]);

  useGSAP(
    () => {
      if (!flashSaved || !checkRef.current || prefersReducedMotion()) return;
      gsap.fromTo(
        checkRef.current,
        { scale: 0.6, autoAlpha: 0 },
        { scale: 1, autoAlpha: 1, duration: 0.35, ease: 'power2.out' }
      );
    },
    { scope: rootRef, dependencies: [flashSaved] }
  );

  const isSaved = label === '已保存';
  const interactive = !disabled && !loading && !isSaved;
  const showCheck = isSaved || flashSaved;
  // 写入中在按钮原位交代进度，而不是只靠脉冲与禁用态
  const displayLabel = loading
    ? label === '更新策略'
      ? '正在更新…'
      : '正在保存…'
    : label;

  const button = (
    <button
      type="button"
      className={[
        'grid-save-island',
        isSaved ? 'grid-save-island--saved' : '',
        loading ? 'grid-save-island--loading' : '',
        disabled && !isSaved ? 'grid-save-island--disabled' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      disabled={!interactive}
      aria-busy={loading}
      aria-label={displayLabel}
      onClick={() => {
        if (!interactive) return;
        onSave();
      }}
    >
      <span className="grid-save-island__pulse" aria-hidden />
      {showCheck ? (
        <span ref={checkRef} className="grid-save-island__check" aria-hidden>
          <CheckOutlined />
        </span>
      ) : null}
      {/* key 随文案切换重挂载：状态换挡有一次轻淡入 */}
      <span key={displayLabel} className="grid-save-island__label">
        {displayLabel}
      </span>
    </button>
  );

  return (
    <div ref={rootRef} className="grid-save-island-wrap">
      {reason && disabled ? (
        <span className="grid-save-island-wrap__tooltip" title={reason}>
          {button}
        </span>
      ) : (
        button
      )}
      {reason ? (
        <span className="grid-summary-bar__reason">{reason}</span>
      ) : null}
    </div>
  );
}
