'use client';

import { INDEX_WATCHES } from '@/lib/index-levels/catalog';

/**
 * 用原生下拉切换指数，与预览页一致：白底、圆角、右侧自绘箭头。
 */
export function IndexLevelPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (code: string) => void;
}) {
  return (
    <select
      className="index-select"
      aria-label="选择指数"
      value={value}
      onChange={event => onChange(event.target.value)}
    >
      {INDEX_WATCHES.map(item => (
        <option key={item.code} value={item.code}>
          {`${item.name}\u3000${item.code}`}
        </option>
      ))}
    </select>
  );
}
