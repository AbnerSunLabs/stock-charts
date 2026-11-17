'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';

import { INDEX_WATCHES } from '@/lib/index-levels/catalog';

const MENU_KEYS: Record<string, number | 'start' | 'end'> = {
  ArrowDown: 1,
  ArrowUp: -1,
  Home: 'start',
  End: 'end',
};

/**
 * 自绘列表。macOS 原生 select 会按控件高度放大弹出层，和页头对不齐。
 */
export function IndexLevelPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (code: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const current = INDEX_WATCHES.find(item => item.code === value) ?? INDEX_WATCHES[0];

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    rootRef.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]')?.focus();
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="index-select-wrap" ref={rootRef}>
      <button
        type="button"
        className="index-select"
        aria-label="选择指数"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen(next => !next)}
      >
        {`${current.name}\u3000${current.code}`}
      </button>
      {open ? (
        <IndexMenu
          id={listId}
          value={value}
          onPick={code => {
            onChange(code);
            setOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}

function IndexMenu({
  id,
  value,
  onPick,
}: {
  id: string;
  value: string;
  onPick: (code: string) => void;
}) {
  const move = (event: ReactKeyboardEvent<HTMLUListElement>): void => {
    const step = MENU_KEYS[event.key];
    if (step === undefined) return;
    const options = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="option"]'));
    const index = options.findIndex(node => node === document.activeElement);
    event.preventDefault();
    const next = step === 'start' ? 0 : step === 'end' ? options.length - 1 : index + step;
    options[(next + options.length) % options.length]?.focus();
  };

  return (
    <ul className="index-menu" id={id} role="listbox" aria-label="选择指数" onKeyDown={move}>
      {INDEX_WATCHES.map(item => (
        <li key={item.code} role="presentation">
          <button type="button" role="option" aria-selected={item.code === value} onClick={() => onPick(item.code)}>
            <span>{item.name}</span>
            <span className="index-menu-code">{item.code}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
