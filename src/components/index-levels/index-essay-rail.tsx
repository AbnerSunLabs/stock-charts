'use client';

import { useEffect, useRef } from 'react';

import { usePresence } from '@/hooks/use-presence';
import { quoteSource } from '@/lib/index-levels/catalog';
import { essayHref, type IndexEssay } from '@/lib/index-levels/index-essays';

/** 面板退场过渡时长 + 余量，与 index-levels.css 中 essay-panel 的过渡保持一致 */
const ESSAY_EXIT_MS = 280;

/** 点开后从右侧盖上来，不占指数图的位置；关闭时先滑出再卸载。 */
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
  const triggerRef = useRef<HTMLElement | null>(null);
  const { mounted, visible } = usePresence(open, ESSAY_EXIT_MS);

  useEffect(() => {
    if (!open) return undefined;
    triggerRef.current = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // 面板卸载后焦点若掉到 body，还给打开它的触发元素（键盘路径下尤为必要）
  useEffect(() => {
    if (mounted) return;
    const trigger = triggerRef.current;
    if (trigger && document.activeElement === document.body) {
      trigger.focus?.();
    }
  }, [mounted]);

  if (!mounted) return null;

  return (
    <aside
      className="essay-rail"
      data-open={visible ? 'true' : 'false'}
      role="dialog"
      aria-modal="true"
      aria-label="E大怎么说"
    >
      <button type="button" className="essay-backdrop" aria-label="关闭发言" onClick={onClose} />
      <div className="essay-panel">
        <div className="essay-head">
          <div>
            <h2>E大怎么说</h2>
            <p>估值、仓位、买卖节奏。对照性的一句没有单列。{essays.length} 篇。</p>
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
