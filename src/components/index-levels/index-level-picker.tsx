'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';

import { usePresence } from '@/hooks/use-presence';
import { INDEX_WATCHES } from '@/lib/index-levels/catalog';

const MENU_KEYS: Record<string, number | 'start' | 'end'> = {
  ArrowDown: 1,
  ArrowUp: -1,
  Home: 'start',
  End: 'end',
};

/** 与 --motion-duration-exit-small 同值的收起延时：菜单淡出后再卸载。 */
const MENU_EXIT_MS = 140;

/**
 * 自绘列表。macOS 原生 select 会按控件高度放大弹出层，和页头对不齐。
 * 状态变化：开 = 顶部原点缩放淡入，合 = 更短的淡出（退场比进场短）。
 */
export function IndexLevelPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (code: string) => void;
}) {
  const [open, setOpen] = useState(false);
  // 菜单在收起动画结束前保持挂载，避免淡出被卸载斩断。
  const [menuMounted, setMenuMounted] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listId = useId();
  const { mounted, visible } = usePresence(open, MENU_EXIT_MS);
  const current = INDEX_WATCHES.find(item => item.code === value) ?? INDEX_WATCHES[0];

  useEffect(() => {
    if (open) {
      setMenuMounted(true);
      return undefined;
    }
    const timer = window.setTimeout(() => setMenuMounted(false), MENU_EXIT_MS);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    // 依赖 menuMounted：菜单真实挂载后再把焦点移到当前选项（open 翻转的那次提交里
    // 菜单还不存在，querySelector 落空会让方向键失灵）
    if (!open || !menuMounted) return undefined;
    const onPointer = (event: MouseEvent) => {
      if (!root?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      // 键盘收起时把焦点还给触发按钮，避免焦点落在即将卸载的菜单上。
      triggerRef.current?.focus();
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
      // 关闭即把焦点移出菜单：退场窗口内 aria-hidden 不能包住持有焦点的元素
      if (root?.contains(document.activeElement)) {
        root
          ?.querySelector<HTMLButtonElement>('.index-select')
          ?.focus();
      }
    };
  }, [open, menuMounted]);

  // 菜单由 usePresence 控制晚一帧挂载，聚焦选中项要等可见态而非 open 边沿
  useEffect(() => {
    if (!visible) return;
    rootRef.current
      ?.querySelector<HTMLButtonElement>('[aria-selected="true"]')
      ?.focus();
  }, [visible]);

  // 菜单卸载后焦点若掉到 body，还给触发按钮。
  // 只在"曾挂载过"之后生效：初次挂载（mounted 恒为 false 的首帧）不能抢焦点
  const wasMountedRef = useRef(false);
  useEffect(() => {
    if (mounted) {
      wasMountedRef.current = true;
      return;
    }
    if (!wasMountedRef.current) return;
    if (document.activeElement === document.body) {
      rootRef.current
        ?.querySelector<HTMLButtonElement>('.index-select')
        ?.focus();
    }
  }, [mounted]);

  return (
    <div className="index-select-wrap" ref={rootRef}>
      <button
        type="button"
        className="index-select"
        ref={triggerRef}
        aria-label="选择指数"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen(next => !next)}
      >
        {`${current.name}　${current.code}`}
      </button>
      {menuMounted ? (
        <IndexMenu
          id={listId}
          open={visible}
          value={value}
          open={open}
          onPick={code => {
            onChange(code);
            setOpen(false);
            triggerRef.current?.focus();
          }}
        />
      ) : null}
    </div>
  );
}

function IndexMenu({
  id,
  open,
  value,
  open,
  onPick,
}: {
  id: string;
  /** 是否处于可见态（退场期间为 false，驱动 data-open 播放收起过渡） */
  open: boolean;
  value: string;
  open: boolean;
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
    <ul
      className="index-menu"
      id={id}
      role="listbox"
      aria-label="选择指数"
      data-open={open ? 'true' : 'false'}
      onKeyDown={move}
    >
      {INDEX_WATCHES.map(item => (
        <li key={item.code} role="presentation">
          <button
            type="button"
            role="option"
            aria-selected={item.code === value}
            tabIndex={open ? 0 : -1}
            onClick={() => onPick(item.code)}
          >
            <span>{item.name}</span>
            <span className="index-menu-code">{item.code}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
