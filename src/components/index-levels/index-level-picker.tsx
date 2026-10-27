'use client';

import { useEffect, useState } from 'react';
import { Select } from 'antd';

import { INDEX_WATCHES } from '@/lib/index-levels/catalog';

/**
 * 用可搜索的选择器切换指数。名单变长之后不再铺成一排页签。
 * Select 在服务端和浏览器的节点对不上，所以等挂载后再渲染。
 */
export function IndexLevelPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (code: string) => void;
}) {
  const ready = usePickerReady();
  if (!ready) return <div className="index-picker index-picker-pending" />;
  return (
    <Select
      className="index-picker"
      classNames={{ popup: { root: 'index-picker-popup' } }}
      showSearch
      size="large"
      value={value}
      aria-label="指数"
      optionFilterProp="label"
      options={INDEX_WATCHES.map(item => ({
        value: item.code,
        label: `${item.name} ${item.code}`,
      }))}
      onChange={onChange}
    />
  );
}

function usePickerReady(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return ready;
}
