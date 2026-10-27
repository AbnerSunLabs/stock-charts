'use client';

import { useLayoutEffect, useRef, useState } from 'react';

import { quoteHref, type IndexQuote } from '@/lib/index-levels/catalog';

function byNewest(quotes: IndexQuote[]): IndexQuote[] {
  return [...quotes].sort((a, b) => b.date.localeCompare(a.date) || b.postId - a.postId);
}

function flatText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** 超出两行时把 ... 接在最后一个字后面，和正文同一条基线。 */
function fitTwoLines(node: HTMLElement, text: string): string {
  const width = node.clientWidth;
  if (width <= 0) return text;
  const style = getComputedStyle(node);
  const probe = document.createElement('p');
  // 放到滚动容器外面。挂在文章节点上时，探针高度会把列表撑开，ResizeObserver 再量一次，文章就来回抖。
  probe.style.cssText = `position:fixed;left:-9999px;top:0;visibility:hidden;width:${width}px;font:${style.font};line-height:${style.lineHeight};margin:0;padding:0;height:auto;`;
  document.body.appendChild(probe);
  const maxHeight = parseFloat(style.lineHeight) * 2 + 0.5;
  const fits = (value: string) => {
    probe.textContent = value;
    return probe.scrollHeight <= maxHeight;
  };
  let result = text;
  if (!fits(text)) {
    let low = 0;
    let high = text.length;
    while (low < high) {
      const mid = Math.ceil((low + high) / 2);
      if (fits(`${text.slice(0, mid).trimEnd()}...`)) low = mid;
      else high = mid - 1;
    }
    result = `${text.slice(0, low).trimEnd()}...`;
  }
  probe.remove();
  return result;
}

function ArticlePreview({ text }: { text: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const flat = flatText(text);
  const [preview, setPreview] = useState(flat);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    let active = true;
    let lastWidth = -1;
    const measure = () => {
      const currentNode = ref.current;
      if (!active || !currentNode) return;
      const width = currentNode.clientWidth;
      if (Math.abs(width - lastWidth) < 1) return;
      lastWidth = width;
      const next = fitTwoLines(currentNode, flat);
      setPreview(current => (current === next ? current : next));
    };
    measure();
    void document.fonts.ready.then(measure);
    const observer = new ResizeObserver(measure);
    observer.observe(node.parentElement ?? node);
    return () => {
      active = false;
      observer.disconnect();
    };
  }, [flat]);

  return <p ref={ref}>{preview}</p>;
}

/**
 * 一篇且慢帖列成一条。列表里只露两行，省略号接在末字后面。
 */
export function IndexQuoteLedger({ quotes }: { quotes: IndexQuote[] }) {
  return (
    <div className="ledger">
      {byNewest(quotes).map(quote => (
        <article className="entry" key={quote.postId}>
          <time dateTime={quote.date}>{quote.date}</time>
          <ArticlePreview text={quote.text} />
          <a href={quoteHref(quote)} target="_blank" rel="noreferrer">
            查看原文
          </a>
        </article>
      ))}
    </div>
  );
}
