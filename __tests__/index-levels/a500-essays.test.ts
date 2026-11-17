import { A500_ESSAYS } from '@/lib/index-levels/a500-essays';
import { essaysForIndex } from '@/lib/index-levels/index-essays';

describe('中证A500 发言', () => {
  it('22 篇按时间从新到旧，只收估值、仓位和买卖节奏', () => {
    expect(essaysForIndex('000510.SH')).toBe(A500_ESSAYS);
    expect(A500_ESSAYS).toHaveLength(22);
    expect(A500_ESSAYS[0]).toMatchObject({ date: '2026-11-06', postId: 95497 });
    expect(A500_ESSAYS.at(-1)).toMatchObject({ date: '2026-04-28', postId: 74371 });
    const dates = A500_ESSAYS.map(essay => essay.date);
    expect([...dates].sort((a, b) => b.localeCompare(a))).toEqual(dates);
    expect(A500_ESSAYS.find(essay => essay.postId === 88837)?.paragraphs.join('')).toContain('已经不算贵了');
    expect(A500_ESSAYS.every(essay => essay.paragraphs.length > 0)).toBe(true);
  });

  it('对照性的帖子不单列，其他指数没有这栏', () => {
    const ids = A500_ESSAYS.map(essay => essay.postId);
    expect(ids).not.toContain(84115);
    expect(ids).not.toContain(86761);
    expect(ids).not.toContain(90235);
    expect(ids).not.toContain(94189);
    expect(essaysForIndex('000905.SH')).toEqual([]);
  });
});
