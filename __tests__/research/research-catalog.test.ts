import { resolveResearchMenuKey } from '@/components/research/research-catalog';

describe('resolveResearchMenuKey', () => {
  it('工具详情高亮对应菜单', () => {
    expect(resolveResearchMenuKey('/view/sunburst')).toBe('/view/sunburst');
    expect(resolveResearchMenuKey('/view/grid')).toBe('/view/grid');
    expect(resolveResearchMenuKey('/view/index-levels')).toBe('/view/index-levels');
  });

  it('工具子路径仍高亮该工具', () => {
    expect(resolveResearchMenuKey('/view/sunburst/opengraph-image')).toBe('/view/sunburst');
  });

  it('一览页和未知路径不点亮菜单', () => {
    expect(resolveResearchMenuKey('/view/tools')).toBe('');
    expect(resolveResearchMenuKey('/view/tools/extra')).toBe('');
  });

  it('前缀相近的路径不会误匹配', () => {
    expect(resolveResearchMenuKey('/view/gridiron')).toBe('');
  });
});
