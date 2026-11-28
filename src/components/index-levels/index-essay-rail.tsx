'use client';

import { useEffect, useRef, useState } from 'react';

import { usePresence } from '@/hooks/use-presence';
import { quoteSource } from '@/lib/index-levels/catalog';
import { essayHref, type IndexEssay } from '@/lib/index-levels/index-essays';

/** 与 --motion-duration-exit-large 同值的卸载延时：面板滑出动画放完再摘 DOM。 */
const RAIL_EXIT_MS = 240;

/** Focus Trap：Tab / Shift+Tab 在面板可聚焦元素间循环，不落到遮罩后的页面上。 */
function trapTabKey(panel: HTMLElement, event: KeyboardEvent): void {
  const focusables = panel.querySelectorAll<HTMLElement>(
    'a[href], button:not([disabled])',
  );
  if (focusables.length === 0) return;
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

/** 点开后从右侧盖上来，不占指数图的位置。退场完整保留后再卸载。 */
export function EssayRail({
  essays,
  open,
  onClose,
}: {
  essays: IndexEssay[];
  open: boolean;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  // 状态变化：关闭 = 面板滑出 + 遮罩淡出后再卸载（禁止早卸载斩断退场）。
  const [mounted, setMounted] = useState(open);

  useEffect(() => {
    if (open) {
      setMounted(true);
      return undefined;
    }
    const timer = window.setTimeout(() => setMounted(false), RAIL_EXIT_MS);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    // 依赖 mounted：面板真实挂载后才聚焦关闭按钮（open 翻转的那次提交里 ref 还是空，
    // 焦点会留在背景页面，Tab 陷阱拦不住）
    if (!open || !mounted) return undefined;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key === 'Tab' && panelRef.current) trapTabKey(panelRef.current, event);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, mounted, onClose]);

  if (!mounted) return null;

  return (
    <aside
      className="essay-rail"
      data-open={open ? 'true' : 'false'}
      role="dialog"
      aria-modal="true"
      aria-label="E大怎么说"
    >
      <button
        type="button"
        className="essay-backdrop"
        tabIndex={-1}
        aria-label="关闭发言"
        onClick={onClose}
      />
      <div className="essay-panel" ref={panelRef}>
        <div className="essay-head">
          <div>
            <h2>E大怎么说</h2>
            <p>聚焦估值、仓位与买卖节奏，共 {essays.length} 篇（单句观点已归入点位下方）。</p>
          </div>
          <button type="button" className="essay-close" ref={closeRef} onClick={onClose}>关闭</button>
        </div>
        <section className="level-sheet" aria-label="发言列表">
          {essays.map(essay => {
            const href = essayHref(essay.postId);
            return (
              <article className="utter" key={essay.id}>
                <time dateTime={essay.date}>{essay.date.replaceAll('-', '/')}</time>
                <div className="words">
                  {essay.note ? <p className="essay-note">{essay.note}</p> : null}
                  {essay.paragraphs.map((text, index) => (
                    <p key={`${essay.id}-${index}`}>{text}</p>
                  ))}
                  <a href={href} data-source={quoteSource(href)} target="_blank" rel="noreferrer">查看原文</a>
                </div>
              </article>
            );
          })}
        </section>
      </div>
    </aside>
  );
}
