'use client';

import { CheckOutlined } from '@ant-design/icons';
import { useGSAP } from '@gsap/react';
import { gsap } from 'gsap';
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { HelpTooltip } from '@/components/shared/help-tooltip';
import { createPortal } from 'react-dom';

gsap.registerPlugin(useGSAP);

export interface GridStrategyNameOverlayProps {
  open: boolean;
  mode: 'create' | 'rename';
  initialName?: string;
  initialSymbol?: string;
  initialNote?: string;
  loading: boolean;
  error: string | null;
  onCancel: () => void;
  onSubmit: (name: string, symbol: string, note: string) => Promise<void>;
}

type OverlayPhase = 'form' | 'success';

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * 自建居中命名浮层：GSAP 进退场与成功确认（替代 Ant Modal）。
 */
export function GridStrategyNameOverlay({
  open,
  mode,
  initialName,
  initialSymbol,
  initialNote,
  loading,
  error,
  onCancel,
  onSubmit,
}: GridStrategyNameOverlayProps) {
  const titleId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [mounted, setMounted] = useState(false);
  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [note, setNote] = useState('');
  const [phase, setPhase] = useState<OverlayPhase>('form');
  const [submitting, setSubmitting] = useState(false);
  const closingRef = useRef(false);

  const busy = loading || submitting;
  const trimmed = name.trim();
  const trimmedSymbol = symbol.trim();
  const invalid =
    trimmed.length < 1 ||
    trimmed.length > 50 ||
    trimmedSymbol.length < 1 ||
    trimmedSymbol.length > 32 ||
    note.trim().length > 200;
  const title = mode === 'create' ? '保存策略' : '编辑策略';
  const confirmLabel = '保存';
  const successLabel = mode === 'create' ? '已保存' : '已更新';

  useEffect(() => {
    if (open) {
      setMounted(true);
      setPhase('form');
      setName(initialName ?? '');
      setSymbol(initialSymbol ?? '');
      setNote(initialNote ?? '');
      setSubmitting(false);
      closingRef.current = false;
      return;
    }
    if (!closingRef.current) {
      setMounted(false);
      setPhase('form');
      setSubmitting(false);
    }
  }, [open, initialName, initialSymbol, initialNote]);

  const finishClose = useCallback(() => {
    setMounted(false);
    setPhase('form');
    setSubmitting(false);
    closingRef.current = false;
    onCancel();
  }, [onCancel]);

  const animateOut = useCallback(
    (contextSafe: (fn: () => void) => () => void) => {
      if (closingRef.current || !rootRef.current) {
        finishClose();
        return;
      }
      closingRef.current = true;
      const reduce = prefersReducedMotion();
      const backdrop = rootRef.current.querySelector('.grid-name-overlay__backdrop');
      const panel = rootRef.current.querySelector('.grid-name-overlay__panel');
      if (reduce) {
        finishClose();
        return;
      }
      const tl = gsap.timeline({
        onComplete: contextSafe(() => finishClose()),
      });
      tl.to(panel, { autoAlpha: 0, y: 12, scale: 0.97, duration: 0.2, ease: 'power2.in' }, 0);
      tl.to(backdrop, { autoAlpha: 0, duration: 0.18, ease: 'power2.in' }, 0);
    },
    [finishClose]
  );

  const { contextSafe } = useGSAP(
    () => {
      if (!mounted || !rootRef.current || !open) return;
      const reduce = prefersReducedMotion();
      const backdrop = rootRef.current.querySelector('.grid-name-overlay__backdrop');
      const panel = rootRef.current.querySelector('.grid-name-overlay__panel');
      if (reduce) {
        gsap.set([backdrop, panel], { autoAlpha: 1, y: 0, scale: 1 });
        inputRef.current?.focus();
        return;
      }
      gsap.set(backdrop, { autoAlpha: 0 });
      gsap.set(panel, { autoAlpha: 0, y: 16, scale: 0.96 });
      const tl = gsap.timeline({
        onComplete: () => inputRef.current?.focus(),
      });
      tl.to(backdrop, { autoAlpha: 1, duration: 0.24, ease: 'power2.out' }, 0);
      tl.to(
        panel,
        { autoAlpha: 1, y: 0, scale: 1, duration: 0.28, ease: 'power2.out' },
        0.04
      );
    },
    { scope: rootRef, dependencies: [mounted, open] }
  );

  useGSAP(
    () => {
      if (phase !== 'success' || !rootRef.current) return;
      const reduce = prefersReducedMotion();
      const form = rootRef.current.querySelector('.grid-name-overlay__form');
      const success = rootRef.current.querySelector('.grid-name-overlay__success');
      if (reduce) {
        gsap.set(form, { autoAlpha: 0 });
        gsap.set(success, { autoAlpha: 1 });
        const timer = window.setTimeout(() => animateOut(contextSafe), 400);
        return () => window.clearTimeout(timer);
      }
      const tl = gsap.timeline({
        onComplete: contextSafe(() => animateOut(contextSafe)),
      });
      tl.to(form, { autoAlpha: 0, y: -8, duration: 0.18, ease: 'power2.in' }, 0);
      tl.fromTo(
        success,
        { autoAlpha: 0, scale: 0.92 },
        { autoAlpha: 1, scale: 1, duration: 0.28, ease: 'power2.out' },
        0.08
      );
      tl.to({}, { duration: 0.45 });
    },
    { scope: rootRef, dependencies: [phase] }
  );

  const requestClose = contextSafe(() => {
    if (busy || phase === 'success') return;
    animateOut(contextSafe);
  });

  const handleSubmit = contextSafe(async () => {
    if (invalid || busy || phase === 'success') return;
    setSubmitting(true);
    try {
      await onSubmit(trimmed, trimmedSymbol, note.trim());
      setPhase('success');
    } catch {
      // 错误由父层 error prop 展示
    } finally {
      setSubmitting(false);
    }
  });

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      requestClose();
    }
  };

  if (!mounted || typeof document === 'undefined') {
    return null;
  }

  const host =
    document.querySelector('.grid-shell') ?? document.body;

  return createPortal(
    <div
      ref={rootRef}
      className="grid-name-overlay"
      onKeyDown={onKeyDown}
    >
      <button
        type="button"
        className="grid-name-overlay__backdrop"
        aria-label="关闭"
        disabled={busy || phase === 'success'}
        onClick={requestClose}
      />
      <div
        className="grid-name-overlay__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="grid-name-overlay__form">
          <h2 id={titleId} className="grid-name-overlay__title">
            {title}
          </h2>
          <label className="grid-name-overlay__label" htmlFor="grid-strategy-name-input">
            <span className="grid-name-overlay__required" aria-hidden>
              *
            </span>
            策略名称
            <HelpTooltip title="1～50 个字符，同账号下名称不可重复" />
          </label>
          <input
            ref={inputRef}
            id="grid-strategy-name-input"
            className={`grid-name-overlay__input${
              error ? ' grid-name-overlay__input--error' : ''
            }`}
            value={name}
            maxLength={50}
            placeholder="例如：沪深300低吸"
            disabled={busy || phase === 'success'}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'grid-strategy-name-help' : undefined}
            onChange={event => setName(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter') {
                event.preventDefault();
                void handleSubmit();
              }
            }}
          />
          {error ? (
            <p
              id="grid-strategy-name-help"
              className="grid-name-overlay__help grid-name-overlay__help--error"
            >
              {error}
            </p>
          ) : null}
          <label className="grid-name-overlay__label" htmlFor="grid-strategy-symbol-input">
            <span className="grid-name-overlay__required" aria-hidden>
              *
            </span>
            标的代码
            <HelpTooltip title="用于组合看板展示，最多 32 个字符" />
          </label>
          <input
            id="grid-strategy-symbol-input"
            className="grid-name-overlay__input"
            value={symbol}
            maxLength={32}
            placeholder="例如：159928"
            disabled={busy || phase === 'success'}
            onChange={event => setSymbol(event.target.value)}
          />
          <label className="grid-name-overlay__label" htmlFor="grid-strategy-note-input">
            备注
            <HelpTooltip title="组合看板卡片上用 Tag 展示" />
          </label>
          <textarea
            id="grid-strategy-note-input"
            className="grid-name-overlay__textarea"
            value={note}
            maxLength={200}
            placeholder="例如：只做震荡段"
            disabled={busy || phase === 'success'}
            onChange={event => setNote(event.target.value)}
          />
          <div className="grid-name-overlay__footer">
            <button
              type="button"
              className="grid-name-overlay__btn grid-name-overlay__btn--ghost"
              disabled={busy || phase === 'success'}
              onClick={requestClose}
            >
              取消
            </button>
            <button
              type="button"
              className="grid-name-overlay__btn grid-name-overlay__btn--primary"
              disabled={invalid || busy || phase === 'success'}
              onClick={() => void handleSubmit()}
            >
              {busy ? '保存中…' : confirmLabel}
            </button>
          </div>
        </div>
        <div className="grid-name-overlay__success" aria-live="polite">
          <span className="grid-name-overlay__success-icon" aria-hidden>
            <CheckOutlined />
          </span>
          <span className="grid-name-overlay__success-label">{successLabel}</span>
        </div>
      </div>
    </div>,
    host
  );
}
