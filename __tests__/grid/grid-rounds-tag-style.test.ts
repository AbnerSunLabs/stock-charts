import {
  gridRoundsTagStyle,
  sumChildRounds,
} from '@/lib/grid/grid-rounds-tag-style';

describe('grid-rounds-tag-style', () => {
  it('0 轮为灰底 Tag', () => {
    expect(gridRoundsTagStyle(0)).toEqual({
      background: '#fafafa',
      borderColor: '#d9d9d9',
      color: '#595959',
    });
  });

  it('轮次越高越深蓝，深底白字', () => {
    const one = gridRoundsTagStyle(1);
    const four = gridRoundsTagStyle(4);
    expect(one.background).toBe('rgba(0, 82, 255, 0.3)');
    expect(one.color).toBe('#0a0b0d');
    expect(four.color).toBe('#ffffff');
    expect(gridRoundsTagStyle(10).background).toBe(gridRoundsTagStyle(6).background);
  });

  it('折叠组合轮次为子档之和', () => {
    const getRounds = (id: string) => (id === 'a' ? 0 : 4);
    expect(sumChildRounds(['a', 'b'], getRounds)).toBe(4);
  });
});
