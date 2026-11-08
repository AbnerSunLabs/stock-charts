import { changePct, classifyChange } from '@/lib/index-levels/position';

/** 日涨跌分类：涨红、跌绿，无数据或持平走中性灰（A股语系）。 */
describe('classifyChange', () => {
  test('无上一收盘（首日或数据缺失）为 flat', () => {
    expect(classifyChange(null)).toBe('flat');
  });

  test('恰好持平为 flat，不误读成涨', () => {
    expect(classifyChange(0)).toBe('flat');
  });

  test('按显示精度取整后再分类，+0.004% 不再显示成红色的 +0.00%', () => {
    expect(classifyChange(0.004)).toBe('flat');
    expect(classifyChange(-0.004)).toBe('flat');
    expect(classifyChange(0.005)).toBe('up');
    expect(classifyChange(-0.005)).toBe('down');
  });

  test('下跌为 down', () => {
    expect(classifyChange(-0.01)).toBe('down');
    expect(classifyChange(-12.5)).toBe('down');
  });

  test('上涨为 up', () => {
    expect(classifyChange(0.01)).toBe('up');
    expect(classifyChange(3.66)).toBe('up');
  });
});

/** changePct 与 classifyChange 串联：上一收盘缺失时整链走 flat。 */
describe('changePct', () => {
  test('上一收盘缺失返回 null', () => {
    expect(changePct(1246.38, null)).toBeNull();
  });

  test('上一收盘为零返回 null，避免除零', () => {
    expect(changePct(1246.38, 0)).toBeNull();
  });

  test('正常计算涨跌幅', () => {
    expect(changePct(1030, 1000)).toBeCloseTo(3);
    expect(changePct(970, 1000)).toBeCloseTo(-3);
  });
});
